const express = require('express')
const Result = require('../models/Result')
const { login, findUser } = require('../services/user')
const { PWD_SALT, PRIVATE_KEY, JWT_EXPIRED } = require('../utils/constant')
const { md5, decoded } = require('../utils/index')
const { body, validationResult } = require('express-validator')
const boom = require('boom')
const jwt = require('jsonwebtoken')

const router = express.Router()

router.post(
    '/login',
    [
        body('username').isString().withMessage('用户名必须为字符'),
        body('password').isString().withMessage('密码必须为字符')
        // body('password').isNumeric().withMessage('密码必须为数字')
    ],
    function(req, res, next) {
        const err = validationResult(req)
        // 如果验证结果出现错误，反之则正常执行
        if (!err.isEmpty()) {
            // 获取验证的错误信息提示
            const [{ msg }] = err.errors
            // 使用next()直接将该内容传递到下一个中间件，路由中定义的异常处理中间件将会接受传递过来的‘boom.badRequest(msg)’
            // 显示提示信息，此处为400显示
            next(boom.badRequest(msg))
        } else {
            // 从请求的body中获取用户名和密码
            let { username, password } = req.body
            // 对密码进行md5加密
            password = md5(`${password}${PWD_SALT}`)
            // 查询数据库中是否有匹配的用户名和密码
            login(username, password)
                // 查询结果是promise对象，判断查询结果是否存在
                .then(user => {
                    if (!user || user.length === 0) {
                        new Result('登录失败').fail(res)
                    } else {
                        // 拿到了user，开始生成token
                        // const [_user] = user // user是一个数组，里面只有一个元素对象，即登录用户的信息。将该对象解构出来给_user，如果你想使用其他信息，可以将其那出来。
                        const token = jwt.sign(
                            { username },
                            PRIVATE_KEY,
                            { expiresIn: JWT_EXPIRED }
                        )
                        new Result({ token }, '登录成功').success(res)
                    }
                })
        }
        
    }
)

router.get('/info', function(req, res) {
    const decode = decoded(req)
    // console.log('decode:::', decode)
    if (decode && decode.username) {
        findUser(decode.username).then(user => {
            console.log(user)
            if (user) {
                user.roles = [user.role]
                new Result(user, '用户信息查询成功').success(res)
            } else {
                new Result('用户信息查询失败').fail(res)
            }
        })
    } else {
        new Result('用户信息查询失败').fail(res)
    }
    

})

module.exports = router