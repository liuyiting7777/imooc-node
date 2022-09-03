const express = require('express')
const boom = require('boom')
const userRouter = require('./user')
const bookRouter = require('./book')
const jwtAuth = require('./jwt')
const Result = require('../models/Result')

// 注册路由
const router = express.Router()

router.use(jwtAuth)

router.get('/', function(req, res) {
    res.send('图书管理后台')
})

// 通过 userRouter 来处理 /user 路由，对路由处理进行解耦
router.use('/user', userRouter)

router.use('/book', bookRouter)

/**
 * 集中处理404请求的中间件
 * 注意：该中间件必须放在正常处理流程之后
 * 否则，会拦截正常请求
 */
router.use((req, res, next) => {
    next(boom.notFound('接口不存在'))
    // 等同于 next(new Rrror()) 我们自定义的Error
    // 使用next是为了将这个异常向下传递，方便我们后面的异常处理
})

/**
 * 自定义路由异常处理中间件
 * 注意两点：
 * 第一，方法的参数不能减少
 * 第二，方法的必须放在路由最后
 */
router.use((err, req, res, next) => {
    if (err.name && err.name === 'UnauthorizedError') {
        // 说明是token错误

        const { status = 401, message } = err // 如果没有就给个默认值401
        new Result(null, 'Token验证失败', {
            error: status,
            errorMsg: message
        }).jwtError(res.status(status)) // 如果不使用res.status(status)动态的修改http状态码，而使用res，会默认返回500
    } else {
        // 说明是常规错误

        // console.log('(router/index)自定义异常处理中间件err: ', err)
        const msg = (err && err.message) || '系统错误'
        // console.log('(router/index)自定义异常处理中间件msg: ', msg)
        const statusCode = (err.output && err.output.statusCode) || 500
        const errorMsg = (err.output && err.output.payload && err.output.payload.error) || err.message
        new Result(null, msg, {
            error: statusCode,
            errorMsg
        }).fail(res.status(statusCode))
    }
    
})

module.exports = router