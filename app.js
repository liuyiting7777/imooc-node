const express = require('express')
const router = require('./router')
const fs = require('fs')
const https = require('https')
const bodyParser = require('body-parser')
const cors = require('cors')

// 创建express应用
const app = express()

// 解决跨域问题
app.use(cors())

// 解析查询字符串
app.use(bodyParser.urlencoded({ extended: true }))
// 解析json
app.use(bodyParser.json())

app.use('/', router)

// 密钥
const privateKey = fs.readFileSync('./https/8183564_www.xinwenkan.top.key')
// 证书
const pem = fs.readFileSync('./https/8183564_www.xinwenkan.top.pem')
const credentials = {
    key: privateKey,
    cert: pem
}
const httpsServer = https.createServer(credentials, app)
const SSLPORT = 18082

// 使用express监听5000端口号发起的http请求
const server = app.listen(5000, function() {
    const { address, port } = server.address()
    console.log('Http Server is running on http://%s:%s', address, port)
})

httpsServer.listen(SSLPORT, function() {
    console.log(`HTTPS Server is running on: https://localhost:${SSLPORT}`)
})