const path = require('path')
const fs = require('fs-extra')
const chalk = require('chalk')
// 创建交互选项
const inquirer = require('inquirer')
const clearConsole = require('./utils/clear-console')
const Creator = require('./Creator')

async function create(name) {
    const targetDir = path.join(process.cwd(), name)

    if (fs.existsSync(targetDir)) {
        // 清空控制台
        clearConsole()

        const { action } = await inquirer.prompt([
            {
                name: 'action',
                type: 'list',
                message: `该项目 ${chalk.cyan(targetDir)} 已存在，请选择你要执行的操作:`,
                choices: [
                    { name: '覆盖', value: 'overwrite' },
                    { name: '合并', value: 'merge' },
                    { name: '取消', value: false },
                ],
            },
        ])

        if (!action) {
            return
        }

        if (action === 'overwrite') {
            console.log(`\n移除 ${chalk.cyan(targetDir)}...`)
            await fs.remove(targetDir)
        }
    }

    const creator = new Creator(name, targetDir, getPromptModules())
    creator.create()
}


function getPromptModules() {
    return [
        // 'vue',
        // 'pnpm-monorepo',
        // 'ts-component',
        'vue-component',
        // eslint-disable-next-line import/no-dynamic-require
    ].map((file) => require(`./promptModules/${file}`))
}

module.exports = create;