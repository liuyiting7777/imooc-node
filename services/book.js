const Book = require('../models/Book')
const db = require('../db')
const _ = require('lodash')
const { reject } = require('lodash')
const { debug } = require('../utils/constant')

// 判断电子书在数据库内是否存在
function exists(book) {
    console.log('-----3----进入exists start')
    // console.log('exists::', book)
    const { title, author, publisher } = book
    // console.log(title, author, publisher)
    const sql = `select * from book where title='${title}' and author='${author}' and publisher='${publisher}'`
    console.log('-----3----进入exists end')
    return db.queryOne(sql)
}

async function removeBook(book) {
    if (book) {
        book.reset() // 删除电子书上传后解析完毕生成的文件
        if (book.fileName) {
            const removeBookSql = `delete from book where fileName='${book.fileName}'`
            const removeContentsSql = `delete from contents where fileName='${book.fileName}'`
            await db.querySql(removeBookSql)
            await db.querySql(removeContentsSql)
        }
    }
}

// 创建电子书目录(数据库里有存放图书的book表，和一张单独存放目录的contents表)
async function insertContents(book) {
    const contents = book.getContents()
    // console.log('getContents:', contents)
    if (contents && contents.length > 0) {
        for (let i=0; i < contents.length; i++) {
            // 因为传进来的contents里有些键值对我们不需要，所以需要提取。
            // 可以用{...} = xxx 的方式，也可以用一个插件lodash提取。

            const content = contents[i]
            // 使用lodash里面的pick方法，从现有的content中提取需要的数据
            const _content = _.pick(content, [
                'fileName',
                'id',
                'href',
                'text',
                'order',
                'level',
                'label',
                'pid',
                'navId'
            ])
            // console.log('_content:', _content)
            await db.insert(_content, 'contents')
        }
    }
}

function insertBook(book) {
    console.log('进入services/book.js:insertBook中------------------------------------------')
    return new Promise(async (resolve, reject) => {
        try {
            console.log('-----1-进入try---')
            if (book instanceof Book) {
                console.log('-----2-进入if---')
                const result = await exists(book)
                console.log('result:::', result)
                // const result = false
                console.log('-----4-result---', result)
                if (result) {
                    console.log('进入services/book.js:insertBook中------------------------------------------电子书存在，准备删除book对象')
                    await removeBook(book) // 如果存在，就将当前已经上传的book对象移除
                    reject(new Error('电子书已存在'))
                } else {
                    console.log('进入services/book.js:insertBook中------------------------------------------电子书不存在，准备插入数据库中')
                    await db.insert(book.toDb(), 'book')
                    await insertContents(book)
                    resolve()
                }
            } else {
                reject(new Error('添加的图书对象不合法'))
            }
        } catch (e) {
            reject(e)
        }
    })
}

function updateBook(book) {
    return new Promise(async (resolve, reject) => {
        try {
            if (book instanceof Book) {
                const result = await getBook(book.fileName)
                if (result) {
                    const model = book.toDb() // 从上传的book对象中取出与数据库中字段相关的
                    if (+result.updateType === 0) {
                        reject(new Error('内置图书不能编辑'))
                    } else {
                        // 如果不属于内置图书，则可以更新数据库
                        // console.log('准备进入db.update')
                        await db.update(model, 'book', `where fileName='${book.fileName}'`)
                        resolve()
                    }
                }
            } else{
                reject(new Error('添加的图书对象不合法'))
            }
        } catch (e) {
            reject(e)
        }
    })
}

function getBook(fileName) {
    return new Promise(async (resolve, reject) => {
        const bookSql = `select * from book where fileName='${fileName}'`
        const contentsSql = `select * from contents where fileName='${fileName}' order by \`order\``
        const book = await db.queryOne(bookSql)
        const contents = await db.querySql(contentsSql)
        // console.log('getBook中的contents: ', contents)
        if (book) {
            book.cover = Book.genCoverUrl(book)
            book.contentsTree = Book.genContentsTree(contents)
            resolve(book)
        } else {
            reject(new Error('电子书不存在'))
        }
    })
}

async function getCategory() {
    const sql = 'select * from category order by category asc'
    const result = await db.querySql(sql)
    const categoryList = []
    result.forEach(item => {
        categoryList.push({
            label: item.categoryText,
            value: item.category,
            num: item.num
        })
    })
    return categoryList
}

async function listBook(query) {
    debug && console.log('/services/book listBook: query', query)
    const { category, title, author, page = 1, pageSize = 20, sort } = query
    const offset = (page - 1) * pageSize // 偏移量计算。page=1，从1开始。page=2，偏移20个量，从第21开始
    let bookSql = 'select * from book'
    let where = 'where'
    title && (where = db.andLike(where, 'title', title))
    author && (where = db.andLike(where, 'author', author))
    // 传进来的是category是获取到categoryList里面的label（目录名字），让他和book中的categoryText判断是否相等。
    category && (where = db.and(where, 'categoryText', category))
    // console.log('-----where:', where)
    // 如果where没有改变，说明查询内容不需要指定where。反之，where改变，需要拼接
    if (where !== 'where') {
        bookSql = `${bookSql} ${where}`
    }
    if (sort) {
        const symbol = sort[0] // 字符串取第一个字，可以将字符串看作数组来取第一个元素，即 + 或者 -
        const column = sort.slice(1, sort.length) // 获取sort这个字符串从[1]到最后的所有元素，即将id从字符串中提出
        const order = symbol === '+' ? 'asc' : 'desc'
        bookSql = `${bookSql} order by \`${column}\` ${order}` // 组合排序模块
    }
    let countSql = `select count(*) as count from book` // 统计总计有多少本电子书
    if (where !== 'where') {
        // 如果有查询条件存在，例如查询某一个分类下面有多少电子书
        countSql = `${countSql} ${where}`
    }
    const count = await db.querySql(countSql) // 得到一共有多少本电子书
    // console.log('count:::', count) 结果 [ RowDataPacket { count: 466 } ] ,获取466 数组的第一个元素是对象，对象的count属性是466
    bookSql = `${bookSql} limit ${pageSize} offset ${offset}` // 组合分页模块
    const list = await db.querySql(bookSql)
    list.forEach(book => book.cover = Book.genCoverUrl(book))
    // async下，返回的对象会自动转成promise
    return { list, count: count[0].count, page, pageSize }
}

function deleteBook(fileName) {
    // 因为该方法不需要返回返回值，所以可以使用promise
    return new Promise(async (resolve, reject) => {
        let book = await getBook(fileName)
        if (book) {
            if (+book.updateType === 0) {
                reject(new Error('内置电子书不能删除'))
            } else {
                const bookObj = new Book(null, book) // 因为我们要使用book中的reset删除文件
                const sql = `delete from book where fileName='${fileName}'`
                // 先删除数据库中的内容，然后再删除文件
                db.querySql(sql).then(() => {
                    bookObj.reset()
                    resolve()
                })
            }
        } else {
            reject(new Error('电子书不存在'))
        }
    })
}

module.exports = {
    insertBook,
    getBook,
    updateBook,
    getCategory,
    listBook,
    deleteBook
}