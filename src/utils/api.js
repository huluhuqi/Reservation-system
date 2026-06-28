/**
 * YesApi 果创云 API 适配层
 * 兼容原有 App.vue 的 api.get/post/put/delete 接口调用
 *
 * 使用前请修改下方 APP_KEY 和 API_HOST
 */

// ==================== 配置区域 ====================
const APP_KEY = '4418E8F40E3E27D3EBFD592311539A89'
const API_HOST = 'https://api.yesapi.net'
// =========================================================

/**
 * 生成签名（YesApi 要求的签名算法）
 * 签名规则：将所有非空参数按 key 的 ASCII 升序排列，拼接为 key=value& 形式，末尾加上 &app_key=你的AppKey，然后 MD5
 */
function generateSign(params) {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort()

  const str = sortedKeys.map((k) => `${k}=${params[k]}`).join('&') + `&app_key=${APP_KEY}`

  return md5(str)
}

/**
 * 简易 MD5 实现（浏览器端）
 */
function md5(string) {
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3]
    a = ff(a, b, c, d, k[0], 7, -680876936)
    d = ff(d, a, b, c, k[1], 12, -389564586)
    c = ff(c, d, a, b, k[2], 17, 606105819)
    b = ff(b, c, d, a, k[3], 22, -1044525330)
    a = ff(a, b, c, d, k[4], 7, -176418897)
    d = ff(d, a, b, c, k[5], 12, 1200080426)
    c = ff(c, d, a, b, k[6], 17, -1473231341)
    b = ff(b, c, d, a, k[7], 22, -45705983)
    a = ff(a, b, c, d, k[8], 7, 1770035416)
    d = ff(d, a, b, c, k[9], 12, -1958414417)
    c = ff(c, d, a, b, k[10], 17, -42063)
    b = ff(b, c, d, a, k[11], 22, -1990404162)
    a = ff(a, b, c, d, k[12], 7, 1804603682)
    d = ff(d, a, b, c, k[13], 12, -40341101)
    c = ff(c, d, a, b, k[14], 17, -1502002290)
    b = ff(b, c, d, a, k[15], 22, 1236535329)
    a = gg(a, b, c, d, k[1], 5, -165796510)
    d = gg(d, a, b, c, k[6], 9, -1069501632)
    c = gg(c, d, a, b, k[11], 14, 643717713)
    b = gg(b, c, d, a, k[0], 20, -373897302)
    a = gg(a, b, c, d, k[5], 5, -701558691)
    d = gg(d, a, b, c, k[10], 9, 38016083)
    c = gg(c, d, a, b, k[15], 14, -660478335)
    b = gg(b, c, d, a, k[4], 20, -405537848)
    a = gg(a, b, c, d, k[9], 5, 568446438)
    d = gg(d, a, b, c, k[14], 9, -1019803690)
    c = gg(c, d, a, b, k[3], 14, -187363961)
    b = gg(b, c, d, a, k[8], 20, 1163531501)
    a = gg(a, b, c, d, k[13], 5, -1444681467)
    d = gg(d, a, b, c, k[2], 9, -51403784)
    c = gg(c, d, a, b, k[7], 14, 1735328473)
    b = gg(b, c, d, a, k[12], 20, -1926607734)
    a = hh(a, b, c, d, k[5], 4, -378558)
    d = hh(d, a, b, c, k[8], 11, -2022574463)
    c = hh(c, d, a, b, k[11], 16, 1839030562)
    b = hh(b, c, d, a, k[14], 23, -35309556)
    a = hh(a, b, c, d, k[1], 4, -1530992060)
    d = hh(d, a, b, c, k[4], 11, 1272893353)
    c = hh(c, d, a, b, k[7], 16, -155497632)
    b = hh(b, c, d, a, k[10], 23, -1094730640)
    a = hh(a, b, c, d, k[13], 4, 681279174)
    d = hh(d, a, b, c, k[0], 11, -358537222)
    c = hh(c, d, a, b, k[3], 16, -722521979)
    b = hh(b, c, d, a, k[6], 23, 76029189)
    a = hh(a, b, c, d, k[9], 4, -640364487)
    d = hh(d, a, b, c, k[12], 11, -421815835)
    c = hh(c, d, a, b, k[15], 16, 530742520)
    b = hh(b, c, d, a, k[2], 23, -995338651)
    a = ii(a, b, c, d, k[7], 6, -198630844)
    d = ii(d, a, b, c, k[14], 10, 1126891415)
    c = ii(c, d, a, b, k[5], 15, -1416354905)
    b = ii(b, c, d, a, k[12], 21, -57434055)
    a = ii(a, b, c, d, k[1], 6, 1700485571)
    d = ii(d, a, b, c, k[8], 10, -1894986606)
    c = ii(c, d, a, b, k[15], 15, -1051523)
    b = ii(b, c, d, a, k[6], 21, -2054922799)
    a = ii(a, b, c, d, k[13], 6, 1873313359)
    d = ii(d, a, b, c, k[4], 10, -30611744)
    c = ii(c, d, a, b, k[11], 15, -1560198380)
    b = ii(b, c, d, a, k[2], 21, 1309151649)
    a = ii(a, b, c, d, k[9], 6, -145523070)
    d = ii(d, a, b, c, k[0], 10, -1120210379)
    c = ii(c, d, a, b, k[7], 15, 718787259)
    b = ii(b, c, d, a, k[14], 21, -343485551)
    x[0] = add32(a, x[0])
    x[1] = add32(b, x[1])
    x[2] = add32(c, x[2])
    x[3] = add32(d, x[3])
  }
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t))
    return add32((a << s) | (a >>> (32 - s)), b)
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t) }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t) }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t) }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t) }
  function md51(s) {
    let n = s.length,
      state = [1732584193, -271733879, -1732584194, 271733878],
      i
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)))
    }
    s = s.substring(i - 64)
    let tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3)
    tail[i >> 2] |= 0x80 << ((i % 4) << 3)
    if (i > 55) {
      md5cycle(state, tail)
      for (i = 0; i < 16; i++) tail[i] = 0
    }
    tail[14] = n * 8
    md5cycle(state, tail)
    return state
  }
  function md5blk(s) {
    let md5blks = [],
      i
    for (i = 0; i < 64; i += 4) {
      md5blks[i >> 2] =
        s.charCodeAt(i) +
        (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) +
        (s.charCodeAt(i + 3) << 24)
    }
    return md5blks
  }
  let hex_chr = '0123456789abcdef'.split('')
  function rhex(n) {
    let s = '',
      j = 0
    for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f]
    return s
  }
  function hex(x) {
    for (let i = 0; i < x.length; i++) x[i] = rhex(x[i])
    return x.join('')
  }
  function add32(a, b) {
    return (a + b) & 0xffffffff
  }
  return hex(md51(string))
}

/**
 * 路由映射：将 App.vue 中的 REST 路由映射到 YesApi 表名
 */
const TABLE_MAP = {
  settings: 'kg7500_settings',
  categories: 'kg7500_categories',
  'category-settings': 'kg7500_category_settings',
  instruments: 'kg7500_instruments',
  bookings: 'kg7500_bookings',
  locks: 'kg7500_locks'
}

/**
 * 字段名映射：前端驼峰 → YesApi 下划线
 */
const CAMEL_TO_SNAKE = {
  // 通用字段
  categoryId: 'category_id',
  instrumentId: 'instrument_id',
  instrumentName: 'instrument_name',
  slotStart: 'slot_start',
  slotEnd: 'slot_end',
  slotIndex: 'slot_index',
  userName: 'user_name',
  employeeNo: 'employee_no',
  createdBy: 'created_by',
  createdByName: 'created_by_name',
  scopeType: 'scope_type',
  lockType: 'lock_type',
  startDate: 'start_date',
  // settings 专用
  adminPassword: 'admin_password',
  customSlots: 'custom_slots',
  bookingAdvanceDays: 'booking_advance_days',
  bookingOpenTime: 'booking_open_time',
  users: 'user_list',
  // categories 专用
  name: 'category_name',
  icon: 'category_icon',
  // bookings 专用
  date: 'booking_date',
  remark: 'booking_remark',
  // locks 专用
  lockDate: 'lock_date',
  lockReason: 'lock_reason'
}

/**
 * 反向映射：YesApi 下划线 → 前端驼峰
 */
const SNAKE_TO_CAMEL = {}
for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
  SNAKE_TO_CAMEL[snake] = camel
}

/**
 * 将前端驼峰字段转为 YesApi 下划线字段
 */
function toSnakeCase(data) {
  if (!data || typeof data !== 'object') return data
  const result = {}
  for (const [key, value] of Object.entries(data)) {
    const newKey = CAMEL_TO_SNAKE[key] || key
    result[newKey] = value
  }
  return result
}

/**
 * 将 YesApi 下划线字段转为前端驼峰字段
 */
function toCamelCase(data) {
  if (!data || typeof data !== 'object') return data
  const result = {}
  for (const [key, value] of Object.entries(data)) {
    const newKey = SNAKE_TO_CAMEL[key] || key
    result[newKey] = value
  }
  return result
}

/**
 * 调用 YesApi 基础方法
 * 写操作（Create/Update/Delete）使用 POST，避免 data 过大导致 URL 超长
 */
async function yesApiCall(service, params = {}) {
  const allParams = {
    s: service,
    app_key: APP_KEY,
    ...params
  }

  allParams.sign = generateSign(allParams)

  const body = new URLSearchParams(allParams).toString()
  const writeServices = ['App.Table.Create', 'App.Table.Update', 'App.Table.Delete']
  const isWrite = writeServices.includes(service)

  let response
  if (isWrite) {
    response = await fetch(API_HOST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
  } else {
    response = await fetch(`${API_HOST}/?${body}`)
  }

  const json = await response.json()

  if (json.ret !== 200) {
    throw new Error(
      json.msg ||
      json.data?.err_msg ||
      'YesApi 请求失败'
    )
  }

  if (json.data && json.data.err_code !== 0) {
    throw new Error(
      json.data.err_msg ||
      'YesApi 业务错误'
    )
  }

  return json
}

/**
 * 判断错误是否为"查无数据"
 */
function isNotFoundError(error) {
  const msg = error?.message || ''
  return (
    msg.includes('查无数据') ||
    msg.includes('not exist') ||
    msg.includes('does not exist') ||
    msg.includes('不存在')
  )
}

/**
 * 将前端 params 转为 YesApi where 条件（使用下划线字段名）
 */
function buildWhereConditions(params, dateField = 'booking_date') {
  if (!params) return []
  const conditions = []

  if (params.categoryId) {
    conditions.push(['category_id', '=', String(params.categoryId)])
  }
  if (params.date) {
    conditions.push([dateField, '=', params.date])
  }
  if (params.instrumentId) {
    conditions.push(['instrument_id', '=', String(params.instrumentId)])
  }
  if (params.slotStart !== undefined && params.slotStart !== '') {
    conditions.push(['slot_start', '=', params.slotStart])
  }

  return conditions
}

/**
 * 将 YesApi 返回的数据记录转换为前端期望的格式
 * 1. id → _id, recordId
 * 2. 下划线字段 → 驼峰字段
 * 3. JSON 字段反序列化
 */
function normalizeRecord(record) {
  if (!record) return record
  const result = toCamelCase(record)
  // instrument_name 兼容：前端统一使用 name 显示
  if (result.instrumentName !== undefined && result.name === undefined) {
    result.name = result.instrumentName
  }
  // ID 映射
  if (result.id !== undefined && result._id === undefined) {
    result._id = String(result.id)
  }
  if (result.recordId === undefined && result.id !== undefined) {
    result.recordId = String(result.id)
  }
  // 解析 JSON 字段
  const jsonFields = ['customSlots', 'users', 'ext_data']
  for (const field of jsonFields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = JSON.parse(result[field])
      } catch (e) {
        // 解析失败保持原样
      }
    }
  }
  return result
}

/**
 * 将前端数据转为 YesApi 可存储的格式
 * 1. 移除前端专有字段
 * 2. 驼峰字段 → 下划线字段
 * 3. JSON 字段序列化
 */
function denormalizeData(data) {
  // 移除前端专有字段
  const cleaned = { ...data }
  delete cleaned._id
  delete cleaned.recordId
  delete cleaned.id
  delete cleaned.add_time
  delete cleaned.update_time
  delete cleaned.uuid
  delete cleaned.ext_data

  // 驼峰 → 下划线
  const result = toSnakeCase(cleaned)

  // JSON 序列化复杂字段（使用下划线后的字段名）
  const jsonSnakeFields = ['custom_slots', 'user_list']
  for (const field of jsonSnakeFields) {
    if (result[field] && typeof result[field] === 'object') {
      result[field] = JSON.stringify(result[field])
    }
  }

  return result
}

// ==================== 导出兼容的 api 对象 ====================

export const api = {
  /**
   * GET 请求 - 查询数据
   */
  async get(path, config) {
    const params = config?.params || {}

    // /settings - 获取全局设置（只有一条记录）
    if (path === '/settings') {
      const res = await yesApiCall('App.Table.FreeFindOne', {
        model_name: TABLE_MAP.settings,
        logic: 'and',
        where: JSON.stringify([['id', '>', '0']])
      })
      const record = res.data?.data
      return { data: record ? normalizeRecord(record) : null }
    }

    // /categories - 获取所有类别
    if (path === '/categories') {
      const res = await yesApiCall('App.Table.FreeQuery', {
        model_name: TABLE_MAP.categories,
        logic: 'and',
        where: JSON.stringify([['id', '>', '0']]),
        page: 1,
        perpage: 100
      })
      const list = res.data?.list || []
      return { data: list.map(normalizeRecord) }
    }

    // /category-settings/:categoryId - 获取某类别设置
    const catSettingsMatch = path.match(/^\/category-settings\/(.+)$/)
    if (catSettingsMatch) {
      const categoryId = catSettingsMatch[1]
      const res = await yesApiCall('App.Table.FreeFindOne', {
        model_name: TABLE_MAP['category-settings'],
        logic: 'and',
        where: JSON.stringify([['category_id', '=', String(categoryId)]])
      })
      const record = res.data?.data
      return { data: record ? normalizeRecord(record) : null }
    }

    // /instruments - 获取仪器列表
    if (path === '/instruments') {
      const where = buildWhereConditions(params)
      if (where.length === 0) where.push(['id', '>', '0'])
      const res = await yesApiCall('App.Table.FreeQuery', {
        model_name: TABLE_MAP.instruments,
        logic: 'and',
        where: JSON.stringify(where),
        page: 1,
        perpage: 100
      })
      const list = res.data?.list || []
      return { data: list.map(normalizeRecord) }
    }

    // /bookings - 获取预约记录
    if (path === '/bookings') {
      const where = buildWhereConditions(params)
      if (where.length === 0) where.push(['id', '>', '0'])
      const res = await yesApiCall('App.Table.FreeQuery', {
        model_name: TABLE_MAP.bookings,
        logic: 'and',
        where: JSON.stringify(where),
        page: 1,
        perpage: 500
      })
      const list = res.data?.list || []
      return { data: list.map(normalizeRecord) }
    }

    // /locks - 获取锁定记录
    if (path === '/locks') {
      const where = buildWhereConditions(params, 'lock_date')
      if (where.length === 0) where.push(['id', '>', '0'])
      const res = await yesApiCall('App.Table.FreeQuery', {
        model_name: TABLE_MAP.locks,
        logic: 'and',
        where: JSON.stringify(where),
        page: 1,
        perpage: 500
      })
      const list = res.data?.list || []
      return { data: list.map(normalizeRecord) }
    }

    throw new Error(`未知的 GET 路由: ${path}`)
  },

  /**
   * POST 请求 - 创建数据
   */
  async post(path, data) {
    const tableName = TABLE_MAP[path.replace('/', '')]
    if (!tableName) {
      throw new Error(`未知的 POST 路由: ${path}`)
    }

    // settings 特殊处理：先查是否存在，存在则更新
    if (path === '/settings') {
      let existing = null
      try {
        const existingRes = await yesApiCall('App.Table.FreeFindOne', {
          model_name: TABLE_MAP.settings,
          logic: 'and',
          where: JSON.stringify([['id', '>', '0']])
        })
        existing = existingRes.data?.data
      } catch (e) {
        if (!isNotFoundError(e)) throw e
      }
      if (existing) {
        const updateData = denormalizeData(data)
        await yesApiCall('App.Table.Update', {
          model_name: TABLE_MAP.settings,
          id: existing.id,
          data: JSON.stringify(updateData)
        })
        const getRes = await yesApiCall('App.Table.Get', {
          model_name: TABLE_MAP.settings,
          id: existing.id
        })
        return { data: normalizeRecord(getRes.data?.data) }
      }
    }

    // 通用创建
    let postData = data
    // instruments 表：name 应映射为 instrument_name，remark 应保持为 remark
    if (path === '/instruments') {
      if (postData.name !== undefined && postData.instrumentName === undefined) {
        postData = { ...postData, instrumentName: postData.name }
        delete postData.name
      }
    }
    let createData = denormalizeData(postData)
    if (path === '/instruments' && createData.booking_remark !== undefined) {
      createData.remark = createData.booking_remark
      delete createData.booking_remark
    }
    const res = await yesApiCall('App.Table.Create', {
      model_name: tableName,
      data: JSON.stringify(createData)
    })

    const newId = res.data?.id
    if (newId) {
      const getRes = await yesApiCall('App.Table.Get', {
        model_name: tableName,
        id: newId
      })
      return { data: normalizeRecord(getRes.data?.data) }
    }

    return { data: normalizeRecord(data) }
  },

  /**
   * PUT 请求 - 更新数据
   */
  async put(path, data) {
    // /settings - 更新全局设置
    if (path === '/settings') {
      let existing = null
      try {
        const existingRes = await yesApiCall('App.Table.FreeFindOne', {
          model_name: TABLE_MAP.settings,
          logic: 'and',
          where: JSON.stringify([['id', '>', '0']])
        })
        existing = existingRes.data?.data
      } catch (e) {
        if (!isNotFoundError(e)) throw e
      }
      if (!existing) {
        return this.post('/settings', data)
      }
      const updateData = denormalizeData(data)
      await yesApiCall('App.Table.Update', {
        model_name: TABLE_MAP.settings,
        id: existing.id,
        data: JSON.stringify(updateData)
      })
      const getRes = await yesApiCall('App.Table.Get', {
        model_name: TABLE_MAP.settings,
        id: existing.id
      })
      return { data: normalizeRecord(getRes.data?.data) }
    }

    // /category-settings/:categoryId - 更新类别设置
    const catSettingsMatch = path.match(/^\/category-settings\/(.+)$/)
    if (catSettingsMatch) {
      const categoryId = catSettingsMatch[1]
      let existing = null
      try {
        const existingRes = await yesApiCall('App.Table.FreeFindOne', {
          model_name: TABLE_MAP['category-settings'],
          logic: 'and',
          where: JSON.stringify([['category_id', '=', String(categoryId)]])
        })
        existing = existingRes.data?.data
      } catch (e) {
        if (!isNotFoundError(e)) throw e
      }
      const updateData = denormalizeData(data)
      updateData.category_id = String(categoryId)

      if (existing) {
        await yesApiCall('App.Table.Update', {
          model_name: TABLE_MAP['category-settings'],
          id: existing.id,
          data: JSON.stringify(updateData)
        })
        const getRes = await yesApiCall('App.Table.Get', {
          model_name: TABLE_MAP['category-settings'],
          id: existing.id
        })
        return { data: normalizeRecord(getRes.data?.data) }
      } else {
        return this.post('/category-settings', { ...data, categoryId })
      }
    }

    throw new Error(`未知的 PUT 路由: ${path}`)
  },

  /**
   * DELETE 请求 - 删除数据
   */
  async delete(path) {
    const parts = path.split('/')
    const resource = parts[1]
    const id = parts[2]

    if (!resource || !id) {
      throw new Error(`无效的 DELETE 路由: ${path}`)
    }

    const decodedId = decodeURIComponent(id)

    // /categories/:id - 删除类别（需要级联删除）
    if (resource === 'categories') {
      // 1. 删除该类别下的所有预约
      try {
        const bookingsRes = await yesApiCall('App.Table.FreeQuery', {
          model_name: TABLE_MAP.bookings,
          logic: 'and',
          where: JSON.stringify([['category_id', '=', String(decodedId)]]),
          page: 1,
          perpage: 500
        })
        const bookings = bookingsRes.data?.list || []
        for (const b of bookings) {
          await yesApiCall('App.Table.Delete', {
            model_name: TABLE_MAP.bookings,
            id: b.id
          })
        }
      } catch (e) {
        console.warn('级联删除预约失败', e)
      }

      // 2. 删除该类别下的所有锁定
      try {
        const locksRes = await yesApiCall('App.Table.FreeQuery', {
          model_name: TABLE_MAP.locks,
          logic: 'and',
          where: JSON.stringify([['category_id', '=', String(decodedId)]]),
          page: 1,
          perpage: 500
        })
        const locks = locksRes.data?.list || []
        for (const l of locks) {
          await yesApiCall('App.Table.Delete', {
            model_name: TABLE_MAP.locks,
            id: l.id
          })
        }
      } catch (e) {
        console.warn('级联删除锁定失败', e)
      }

      // 3. 删除该类别下的所有仪器
      try {
        const instRes = await yesApiCall('App.Table.FreeQuery', {
          model_name: TABLE_MAP.instruments,
          logic: 'and',
          where: JSON.stringify([['category_id', '=', String(decodedId)]]),
          page: 1,
          perpage: 100
        })
        const instruments = instRes.data?.list || []
        for (const inst of instruments) {
          await yesApiCall('App.Table.Delete', {
            model_name: TABLE_MAP.instruments,
            id: inst.id
          })
        }
      } catch (e) {
        console.warn('级联删除仪器失败', e)
      }

      // 4. 删除该类别的设置
      try {
        const csRes = await yesApiCall('App.Table.FreeFindOne', {
          model_name: TABLE_MAP['category-settings'],
          logic: 'and',
          where: JSON.stringify([['category_id', '=', String(decodedId)]])
        })
        if (csRes.data?.data) {
          await yesApiCall('App.Table.Delete', {
            model_name: TABLE_MAP['category-settings'],
            id: csRes.data.data.id
          })
        }
      } catch (e) {
        console.warn('级联删除类别设置失败', e)
      }

      // 5. 删除类别本身
      await yesApiCall('App.Table.Delete', {
        model_name: TABLE_MAP.categories,
        id: decodedId
      })

      return { data: { success: true } }
    }

    // 通用删除
    const tableName = TABLE_MAP[resource]
    if (!tableName) {
      throw new Error(`未知的 DELETE 资源: ${resource}`)
    }

    await yesApiCall('App.Table.Delete', {
      model_name: tableName,
      id: decodedId
    })

    return { data: { success: true } }
  }
}
