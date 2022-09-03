const mysql = require('mysql')
const config = require('./config')
const { debug } = require('../utils/constant')
const { isObject } = require('../utils/index')
const { reject } = require('lodash')

function connect() {
    return mysql.createConnection({
        host: config.host,
        user: config.user,
        password: config.password,
        database: config.database,
        multipleStatements: true
    })
}

function querySql(sql) {
    const conn = connect()
    // debug && console.log(sql) // debug为true的时候输出sql信息
    return new Promise((resolve, reject) => {
        try {
            conn.query(sql, (err, results) => {
                if (err) {
                    debug && console.log('db/index.js中querySql查询失败，原因:\n' + JSON.stringify(err))
                    reject(err)
                } else {
                    debug && console.log('db/index.js中querySql查询成功：\n', JSON.stringify(results))
                    resolve(results)
                }
            })
        } catch (e) {
            reject(e)
        } finally {
            conn.end()
        }
    })
}

function queryOne(sql) {
    return new Promise((resolve, reject) => {
        querySql(sql).then(results => {
            if (results && results.length > 0) {
                console.log('queryOne中的result内容是：\n', results)
                resolve(results[0])
            } else {
                // console.log('null')
                // reject(null)
                resolve(null)
            }
        }).catch(err => {
            reject(err)
        })
    })
}

function insert(model, tableName) {
    return new Promise((resolve, reject) => {
        if (!isObject(model)) {
            reject(new Error('插入数据库失败，插入数据非对象'))
        } else {
            const keys = []
            const values = []
            Object.keys(model).forEach(key => {
                // 检查一下key是自身的属性，还是原型链上的属性
                if (model.hasOwnProperty(key)) {
                    // 自身上的key：
                    // 为了避免我们查询字段中有些key在sql中是关键字，从而导致数据库报错。
                    // 例如 select from from book; 其中from是关键字，报错
                    //      select `from` from book; 在这里from就是字符，不会报错
                    keys.push(`\`${key}\``)
                    values.push(`'${model[key]}'`)
                }
            })
            if (keys.length > 0 && values.length > 0) {
                let sql = `INSERT INTO \`${tableName}\` (`
                const keysString = keys.join(',')
                const valuesString = values.join(',')
                sql = `${sql}${keysString}) VALUES (${valuesString})`
                debug && console.log(sql)
                const conn = connect()
                try {
                    conn.query(sql, (err, result) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(result)
                        }
                    })
                } catch(e) {
                    reject(e)
                } finally {
                    conn.end()
                }
            } else {
                reject(new Error('插入数据库失败，对象中没有任何属性'))
            }
        }
    })
}

function update(model, tableName, where) {
    return new Promise((resolve, reject) => {
        if (!isObject(model)) {
            reject(new Error('插入数据库失败，插入数据非对象'))
        } else {
            // insert into a,b values (c,d)
            // update tableName set a=v1,b=v2 where
            const entry = []
            // console.log('将要进入 forEach')
            Object.keys(model).forEach(key => {
                // console.log('进入 forEach')
                if (model.hasOwnProperty(key)) {
                    entry.push(`\`${key}\`='${model[key]}'`)
                }
            })
            if (entry.length > 0) {
                let sql = `update \`${tableName}\` set`
                sql = `${sql} ${entry.join(',')} ${where}`
                debug && console.log('services/book.js:update \n', sql)
                const conn = connect()
                try {
                    conn.query(sql, (err, result) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(result)
                        }
                    })
                } catch (e) {
                    reject(e)
                } finally {
                    conn.end()
                }
            }
        }
    })
}

function and(where, key, value) {
    if (where === 'where') {
        return `${where} \`${key}\`='${value}'`
    } else {
        return `${where} and \`${key}\`='${value}'`
    }
}

function andLike(where, key, value) {
    if (where === 'where') {
        return `${where} \`${key}\` like '%${value}%'` // 前后增加%作为通配符
    } else {
        return `${where} and \`${key}\` like '%${value}%'`
    }
}

module.exports = {
    querySql,
    queryOne,
    insert,
    update,
    and,
    andLike
}