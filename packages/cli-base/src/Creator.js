const PromptModuleAPI = require('./PromptModuleAPI')
const clearConsole = require('./utils/clear-console')
const inquirer = require('inquirer')
const chalk = require('chalk')
const getNpmPackageVersion = require('./utils/get-npm-package-version')
const { hasPnpm, hasGit, hasProjectGit } = require('./utils/env')
const PackageManager = require('./PackageManager')
const writeFileTree = require('./utils/write-file-tree')
const { log } = require('./utils/logger')
const Generator = require('./Generator')
const executeCommand = require('./utils/execute-command')
const { savePreset, rcPath, saveOptions, loadOptions } = require('./utils/options')

let isSavePreset = false
const isManualMode = (answers) => answers.preset === '__manual__' || isSavePreset

class Creator {
    constructor(name, context, promptModules) {
        this.name = name
        this.promptModules = promptModules
        this.context = context

        this.injectedPrompts = []
        this.enddingPrompts = []
        // 默认的项目创建模板提示语，如果上次有保存会有多个选项，如果没有就一个
        const { presetPrompt, featurePrompt } = this.getDefaultPrompts()
        this.presetPrompt = presetPrompt
        this.featurePrompt = featurePrompt
    }

    async create() {
        const { name, context, promptModules } = this
        // 获取各个模块的交互提示语
        const promptAPI = new PromptModuleAPI(this)
        promptModules.forEach((m) => {
            m(promptAPI)
        })

        // 清空控制台
        // clearConsole()

        // 弹出交互提示语并获取用户的选择
        let answers = await inquirer.prompt(this.getFeaturePrompts())
        console.log("🚀 ~ Creator ~ create ~ answers:", answers)
        // {
        //     preset: '__manual__',
        //     feature: 'vue-component',
        //     packageManager: 'pnpm'
        //   }

        if (answers.preset !== '__manual__') {
            const preset = this.getPresets()[answers.preset]
            Object.keys(preset).forEach((key) => {
                answers[key] = preset[key]
            })
        }

        // package.json 文件内容
        const pkg = {
            name,
            version: '0.1.0',
            dependencies: {},
            devDependencies: {},
        }


        const pluginName = `@swl19960204/${answers.feature}-plugin`
        pkg.devDependencies[pluginName] = `^${getNpmPackageVersion(pluginName)}`


        const packageManager = answers.packageManager || loadOptions().packageManager || (hasPnpm() ? 'pnpm' : 'npm')
        const pm = new PackageManager(context, packageManager)

        await writeFileTree(context, {
            'package.json': JSON.stringify(pkg, null, 2),
        })

        log('\n⚙\u{fe0f}  正在安装插件，请稍等片刻...\n')
        await pm.install()

        // 保存默认配置
        if (answers.preset === '__manual__') {
            isSavePreset = true

            try {
                require(`@swl19960204/${answers.feature}-plugin/prompts`)(promptAPI, name)
                const pluginAnswers = await inquirer.prompt(this.getFinalPrompts())
                answers = { ...answers, ...pluginAnswers }
            } catch (error) {
                console.log(error)
            }

            if (answers.packageManager) {
                saveOptions({
                    packageManager: answers.packageManager,
                })
            }

            if (answers.save && answers.saveName && savePreset(answers.saveName, answers)) {
                log(`预设 ${chalk.yellow(answers.saveName)} 保存在 ${chalk.yellow(rcPath)}`)
            }
        }

        log(`\n✨  开始创建项目 ${chalk.yellow(context)}.\n`)
        const generator = new Generator(pkg, context)

        // 查看远程包的版本号
        // npm info vue versions --json

        // 根据用户选择的选项加载相应的模块，在 package.json 写入对应的依赖项
        // 并且将对应的 template 模块渲染
        require(`@swl19960204/${answers.feature}-plugin/generator`)(generator, answers)


        await generator.generate()

        // intilaize git repository before installing deps
        // so that vue-cli-service can setup git hooks.
        const shouldInitGit = this.shouldInitGit()
        if (shouldInitGit) {
            log('🗃  初始化 git 仓库...\n')
            await executeCommand('git', ['init'], context, true)
        }


        log('\n 正在下载依赖，请稍等片刻...\n')
        // 下载依赖
        await pm.install()


        log(`🎉  成功创建项目 ${chalk.yellow(name)}.`)
        this.logEnddingPrompt()
    }

    logEnddingPrompt() {
        this.enddingPrompts.forEach((text) => {
            log(text)
        })
    }

    getFeaturePrompts() {
        const prompts = [this.presetPrompt, this.featurePrompt]

        const savedOptions = loadOptions()
        if (!savedOptions.packageManager && hasPnpm) {
            const packageManagerChoices = []

            if (hasPnpm()) {
                packageManagerChoices.push({
                    name: 'pnpm',
                    value: 'pnpm',
                    short: 'PNPM',
                })
            }

            packageManagerChoices.push({
                name: 'npm',
                value: 'npm',
                short: 'NPM',
            })

            prompts.push({
                name: 'packageManager',
                type: 'list',
                message: '请选择项目的包管理器:',
                choices: packageManagerChoices,
            })
        }

        return prompts
    }

    getFinalPrompts() {
        return [...this.injectedPrompts, ...this.getOtherPrompts()]
    }

    getPresets() {
        const savedOptions = loadOptions()
        return { ...savedOptions.presets }
    }

    getDefaultPrompts() {
        const presets = this.getPresets()
        const presetChoices = Object.entries(presets).map(([name, preset]) => {
            let displayName = name

            return {
                name: `${displayName} (${preset.feature})`,
                value: name,
            }
        })


        const presetPrompt = {
            name: 'preset',
            type: 'list',
            message: '请选择一个默认配置:',
            choices: [
                ...presetChoices,
                {
                    name: '手动选择项目模板',
                    value: '__manual__',
                },
            ],
        }

        const featurePrompt = {
            name: 'feature',
            when: isManualMode,
            type: 'list',
            message: '请选择项目模板：',
            choices: [],
        }

        return {
            presetPrompt,
            featurePrompt,
        }
    }


    getOtherPrompts() {
        const otherPrompts = [
            {
                name: 'save',
                when: isManualMode,
                type: 'confirm',
                message: '是否将这些选择设为默认配置?',
                default: false,
            },
            {
                name: 'saveName',
                when: (answers) => answers.save,
                type: 'input',
                message: '默认配置的名称：',
            },
        ]

        return otherPrompts
    }


    shouldInitGit() {
        if (!hasGit()) {
            return false
        }

        // default: true unless already in a git repo
        return !hasProjectGit(this.context)
    }
}


module.exports = Creator