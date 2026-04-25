// PostGIS 缓冲区分析服务
import express from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// 基础中间件
app.use(cors())
app.use(express.json())

// 数据库连接池
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ogcforge',
  password: process.env.DB_PASSWORD || '123456',
  port: process.env.DB_PORT || 5432,
})

/**
 * 缓冲区分析接口
 * POST /api/buffer
 */
app.post('/api/buffer', async (req, res) => {
  const { wkt, radius } = req.body

  if (!wkt || !radius || typeof radius !== 'number' || radius <= 0) {
    return res
      .status(400)
      .json({ success: false, error: '参数无效：需要有效的 wkt 和大于 0 的 radius' })
  }

  try {
    // 核心SQL：利用 ::geography 确保按米计算，避免椭圆变形[4](@ref)
    const sql = `
      SELECT ST_AsGeoJSON(
        ST_Buffer(
          ST_GeomFromText($1, 4326)::geography,
          $2
        )::geometry
      ) AS buffer
    `
    const result = await pool.query(sql, [wkt, radius])

    if (result.rows[0]?.buffer) {
      res.setHeader('Content-Type', 'application/json')
      res.send(result.rows[0].buffer)
    } else {
      res.status(404).json({ success: false, error: '缓冲区计算失败' })
    }
  } catch (error) {
    console.error('数据库查询错误:', error)
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

// 健康检查
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 PostGIS分析服务已启动: http://localhost:${PORT}`)
  console.log(`💡 缓冲区接口: POST http://localhost:${PORT}/api/buffer`)
})
