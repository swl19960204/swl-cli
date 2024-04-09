const chalk = require('chalk')
const stripAnsi = require('strip-ansi')

const format = (label, msg) =>
    msg
        .split('\n')
        .map((line, i) => (i === 0 ? `${label} ${line}` : line.padStart(stripAnsi(label).length)))
        .join('\n')

const chalkTag = (msg) => chalk.bgBlackBright.white.dim(` ${msg} `)


exports.log = (msg = '', tag = null) => {
    tag ? console.log(format(chalkTag(tag), msg)) : console.log(msg)
}

exports.error = (msg, tag = null) => {
    console.error(format(chalk.bgRed(' ERROR ') + (tag ? chalkTag(tag) : ''), chalk.red(msg)))
    if (msg instanceof Error) {
        console.error(msg.stack)
    }
}