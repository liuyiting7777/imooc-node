const express = require('express')
const multer = require('multer') // 实现文件上传功能
const Result = require('../models/Result')
const Book = require('../models/Book')
const { UPLOAD_PATH } = require('../utils/constant')
const boom = require('boom')
const { decoded } = require('../utils')
const bookService = require('../services/book')
const { response } = require('express')

const router = express.Router()

// /book/upload
router.post(
    '/upload',
    // "single('file')" 指的是：上传单个文件，并且放到req下面的file上。（因此，上传结束后，可以通过 req.file 获取该文件）
    multer({ dest: `${UPLOAD_PATH}/book` }).single('file'),
    function(req, res, next){
        if (!req.file || req.file.length === 0) {
            new Result('上传电子书失败').fail(res)
        } else {
            const book = new Book(req.file)
            // console.log('打印一下我们创建的Book对象', book)
            book.parse()
                .then(book => {
                    // console.log('book', book)
                    new Result(book, '上传电子书成功').success(res)
                })
                .catch(err => {
                    // 向前端发生500错误
                    next(boom.badImplementation(err))
                })
            // new Result('上传电子书成功').success(res)
        }
    }
)
// /book/create
router.post(
    '/create',
    function(req, res, next) {
        // 我们传进来的图书信息在req.body里面
        const decode = decoded(req)
        // console.log('decode', decode) // decode { username: 'admin', iat: 1661181576, exp: 1661185176 }
        if (decode && decode.username) {
            req.body.username = decode.username
        }
        const book = new Book(null, req.body)
        console.log('router.post里面/create中的book:', book)
        bookService.insertBook(book).then(() => {
            console.log('执行成功')
            new Result(book, '上传电子书成功').success(res)
        }).catch(err => {
            next(boom.badImplementation(err))
        })
    }
)
// /book/update
router.post(
    '/update',
    function(req, res, next) {
        // 我们传进来的图书信息在req.body里面
        const decode = decoded(req)
        // console.log('decode', decode) // decode { username: 'admin', iat: 1661181576, exp: 1661185176 }
        if (decode && decode.username) {
            req.body.username = decode.username
        }
        const book = new Book(null, req.body)
        // console.log('router.post里面/create中的book:', book)
        bookService.updateBook(book).then(() => {
            // console.log('执行成功')
            new Result(book, '更新电子书成功').success(res)
        }).catch(err => {
            next(boom.badImplementation(err))
        })
    }
)
// /book/get
router.get('/get', function(req, res, next) {
    const { fileName } = req.query
    if (!fileName) {
        next(boom.badRequest(new Error('参数fileName不能为空')))
    } else {
        bookService.getBook(fileName).then(book => {
            new Result(book, '获取图书信息成功').success(res)
        }).catch(err => {
            next(boom.badImplementation(err))
        })
    }
})
// /book/category
router.get('/category', function(req, res, next) {
    bookService.getCategory().then(category => {
        new Result(category, '获取分类成功').success(res)
    }).catch(err => {
        next(boom.badImplementation(err))
    })
})

// /book/list
router.get('/list', function(req, res, next) {
    bookService.listBook(req.query).then(({ list, count, page, pageSize }) => {
        new Result({ list, count, page: +page, pageSize: +pageSize }, '获取图书列表成功').success(res)
    }).catch(err => {
        next(boom.badImplementation(err))
    })
})

// /book/delete
router.get('/delete', function(req, res, next) {
    const { fileName } = req.query
    if (!fileName) {
        next(boom.badRequest(new Error('参数fileName不能为空')))
    } else {
        bookService.deleteBook(fileName).then(() => {
            new Result('删除图书信息成功').success(res)
        }).catch(err => {
            next(boom.badImplementation(err))
        })
    }
})

module.exports = router