#!/usr/bin/env node
const program = require('commander')
const path = require('path')
const create = require('../src/create')
const getPackage = require('../src/utils/get-package')

const version = getPackage(path.resolve(__dirname, '../')).version || '0.1.0';

program.version(version, '-v, --vers', '脚手架版本')


program
    .command('create <name>')
    .description('create a new project')
    .action(name => {
        create(name)
    })

program.parse()