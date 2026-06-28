<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from './utils/api'

function createDefaultSlots() {
  const slots = []
  let hour = 9
  let minute = 0

  for (let i = 0; i < 18; i++) {
    const startHour = hour
    const startMinute = minute

    minute += 30
    if (minute >= 60) {
      hour += 1
      minute = 0
    }

    slots.push({
      slotIndex: i,
      slotStart: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
      slotEnd: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    })
  }

  return slots
}

function getDefaultSettings() {
  return {
    _id: 'global',
    adminPassword: 'admin123',
    customSlots: createDefaultSlots(),
    bookingAdvanceDays: 1,
    bookingOpenTime: '17:00',
    users: []
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateOnly(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getTodayDate() {
  return formatDate(new Date())
}

function getTomorrowDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return formatDate(date)
}

function getDateLabel(dateStr) {
  const date = parseDateOnly(dateStr)
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return {
    monthDay: `${date.getMonth() + 1}月${date.getDate()}日`,
    weekday: weekMap[date.getDay()]
  }
}

function getDayDiffFromToday(dateStr) {
  const today = parseDateOnly(getTodayDate())
  const target = parseDateOnly(dateStr)
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (24 * 60 * 60 * 1000))
}

function isFutureBookingOpen(openTimeText) {
  const now = new Date()
  const openTime = new Date()
  const [hour, minute] = (openTimeText || '17:00').split(':').map(Number)
  openTime.setHours(hour || 17, minute || 0, 0, 0)
  return now >= openTime
}

function getSlotDateTime(dateStr, slotStart) {
  return new Date(`${dateStr}T${slotStart}:00`)
}

function isPastSlot(dateStr, slotStart) {
  return getSlotDateTime(dateStr, slotStart) <= new Date()
}

function getDateRuleForSlot(dateStr, slotStart) {
  const dayDiff = getDayDiffFromToday(dateStr)
  const advanceDays = Number(systemSettings.value.bookingAdvanceDays || 1)
  const openTimeText = systemSettings.value.bookingOpenTime || '17:00'

  if (dayDiff < 0) {
    return { status: 'expired', text: '已过期' }
  }

  if (dayDiff === 0) {
    if (isPastSlot(dateStr, slotStart)) {
      return { status: 'expired', text: '已过期' }
    }
    return null
  }

  if (dayDiff > advanceDays) {
    return { status: 'locked', text: '未开放' }
  }

  if (!isFutureBookingOpen(openTimeText)) {
    return { status: 'locked', text: `${openTimeText}后开放` }
  }

  return null
}

function buildUserKey(userName, employeeNo) {
  return `${(userName || '').trim()}_${(employeeNo || '').trim()}`
}

function normalizeSlots(rawSlots) {
  return [...(rawSlots || [])]
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
    .map((item, index) => ({
      slotIndex: index,
      slotStart: item.slotStart,
      slotEnd: item.slotEnd
    }))
}

function isValidTimeText(value) {
  return /^\d{2}:\d{2}$/.test(value)
}

function friendlyError(error, fallback) {
  const msg = error?.message || ''
  if (msg.includes('Permission denied')) {
    return `${fallback}：接口权限不足，请检查 Worker 配置和飞书应用权限。`
  }
  return msg || fallback
}

function getDeviceId() {
  const key = 'kg7500_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(key, id)
  }
  return id
}

function getSubmissionStorageKey(deviceId) {
  return `kg7500_submission_logs_${deviceId}`
}

function readSubmissionLogs(deviceId) {
  try {
    const raw = localStorage.getItem(getSubmissionStorageKey(deviceId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeSubmissionLogs(deviceId, logs) {
  localStorage.setItem(getSubmissionStorageKey(deviceId), JSON.stringify(logs))
}

function createLogId() {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const activeTab = ref('booking')
const bookingPage = ref(1)

const deviceId = ref(getDeviceId())
const systemSettings = ref(getDefaultSettings())
const systemSettingsDocId = ref('global')

const instruments = ref([])
const selectedInstrumentId = ref('')
const selectedDate = ref(getTodayDate())
const slots = ref([])
const availabilityMap = ref({})

const categories = ref([])
const selectedCategoryId = ref('')
const selectedCategoryName = ref('')
const categorySettings = ref(null)
const showCategorySelection = ref(true)

const currentLocks = ref([])
const bookingRecords = ref([])
const submissionHistory = ref([])
const selectedSubmissionIds = ref([])
const selectedSlotIndexes = ref([])

const userForm = ref({
  userName: '',
  employeeNo: '',
  remark: ''
})

const activeIdentity = ref({
  userName: '',
  employeeNo: '',
  userKey: ''
})

const adminAuthed = ref(false)
const adminTab = ref('instrument')
const adminSelectedCategoryId = ref('')
const categoryCustomSlots = ref([])

const adminLoginForm = ref({
  password: ''
})

const adminInstrumentForm = ref({
  name: '',
  remark: ''
})

const adminPasswordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const adminUserForm = ref({
  userName: '',
  employeeNo: ''
})

const adminCategoryForm = ref({ name: '', icon: '' })

const adminSlotForm = ref({
  slotStart: '09:00',
  slotEnd: '09:30'
})

const adminLockForm = ref({
  instrumentId: '',
  dateInput: getTodayDate(),
  dates: [],
  longTerm: false,
  slotIndexes: [],
  reason: ''
})

const adminBookingForm = ref({
  advanceDays: 1,
  openTime: '17:00'
})

const batchUserInput = ref('')
const selectedUserKeys = ref([])

const adminSelectedCategory = computed(() =>
  categories.value.find((cat) => cat._id === adminSelectedCategoryId.value) || null
)

const filteredInstruments = computed(() => {
  if (!adminSelectedCategoryId.value) return []
  return instruments.value.filter((item) => item.categoryId === adminSelectedCategoryId.value)
})

const customSlots = computed(() => {
  // 用户预约时：使用 selectedCategoryId 对应的类别时间段（无则空）
  if (selectedCategoryId.value) {
    return normalizeSlots(categoryCustomSlots.value)
  }
  // 管理员设置时：使用 adminSelectedCategoryId 对应的类别时间段（无则空）
  if (adminSelectedCategoryId.value) {
    return normalizeSlots(categoryCustomSlots.value)
  }
  return normalizeSlots(systemSettings.value.customSlots || [])
})
const registeredUsers = computed(() => Array.isArray(systemSettings.value.users) ? systemSettings.value.users : [])
const timeOptions = computed(() => {
  const options = []
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return options
})
const identityReady = computed(() => !!activeIdentity.value.userKey)
const currentUserKey = computed(() => activeIdentity.value.userKey)

const selectedInstrument = computed(() =>
  instruments.value.find((item) => item._id === selectedInstrumentId.value) || null
)

const selectedInstrumentName = computed(() => selectedInstrument.value?.name || '')

const quickDateOptions = computed(() => {
  const maxAdvanceDays = Number(systemSettings.value.bookingAdvanceDays || 1)
  return Array.from({ length: maxAdvanceDays + 1 }, (_, dayDiff) => {
    const date = new Date()
    date.setDate(date.getDate() + dayDiff)
    const value = formatDate(date)
    const label = getDateLabel(value)
    let title = `${dayDiff}天后`
    if (dayDiff === 0) title = '今天'
    if (dayDiff === 1) title = '明天'
    if (dayDiff === 2) title = '后天'

    return {
      key: `day-${dayDiff}`,
      value,
      title,
      ...label
    }
  })
})

const bookingFlowStep = computed(() => {
  if (bookingPage.value === 1) return 1
  if (!selectedInstrumentId.value) return 2
  if (selectedSlotIndexes.value.length === 0) return 3
  return 4
})

const stepItems = computed(() => [
  { step: 1, label: '用户信息' },
  { step: 2, label: '选择仪器' },
  { step: 3, label: '选择日期时间' },
  { step: 4, label: '确认预约' }
])

const selectedSlotsForOperation = computed(() => {
  return slots.value
    .filter((slot) => selectedSlotIndexes.value.includes(slot.slotIndex))
    .sort((a, b) => a.slotIndex - b.slotIndex)
})

const selectedSlotsText = computed(() => {
  if (selectedSlotsForOperation.value.length === 0) return '未选择时段'
  return selectedSlotsForOperation.value
    .map((slot) => `${slot.slotStart}-${slot.slotEnd}`)
    .join('、')
})

const identityText = computed(() => {
  if (!identityReady.value) return '未确认'
  return `${activeIdentity.value.userName}（工号：${activeIdentity.value.employeeNo}）`
})

const pageRuleHint = computed(() => {
  const dayDiff = getDayDiffFromToday(selectedDate.value)
  const advanceDays = Number(systemSettings.value.bookingAdvanceDays || 1)
  const openTimeText = systemSettings.value.bookingOpenTime || '17:00'
  if (dayDiff < 0) return '过去日期仅可查看，不能预约。'
  if (dayDiff === 0) return '当天只能预约未开始的时段。'
  if (dayDiff > advanceDays) return `当前最多只可预约未来 ${advanceDays} 天。`
  return isFutureBookingOpen(openTimeText)
    ? `当前已超过 ${openTimeText}，可以预约未来 ${advanceDays} 天。`
    : `未来 ${advanceDays} 天需当天 ${openTimeText} 后开放预约。`
})

const bookingSummary = computed(() => {
  return {
    userName: activeIdentity.value.userName || userForm.value.userName.trim() || '未填写',
    employeeNo: activeIdentity.value.employeeNo || userForm.value.employeeNo.trim() || '未填写',
    instrumentName: selectedInstrumentName.value || '未选择',
    date: selectedDate.value,
    slots: selectedSlotsText.value
  }
})

const overviewList = computed(() => {
  return instruments.value.slice(0, 4).map((item) => {
    const status = availabilityMap.value[item._id] || {
      status: 'free',
      label: '可用',
      freeCount: customSlots.value.length,
      totalCount: customSlots.value.length
    }
    return {
      ...item,
      ...status
    }
  })
})

const adminTargetInstrumentName = computed(() => {
  const matched = instruments.value.find((item) => item._id === adminLockForm.value.instrumentId)
  return matched?.name || ''
})

const adminLockDatesText = computed(() => {
  if (adminLockForm.value.dates.length === 0) return '未选择具体日期'
  return [...adminLockForm.value.dates].sort().join('、')
})

const adminSelectedSlotsText = computed(() => {
  if (adminLockForm.value.slotIndexes.length === 0) return '全天'
  return customSlots.value
    .filter((slot) => adminLockForm.value.slotIndexes.includes(slot.slotIndex))
    .map((slot) => `${slot.slotStart}-${slot.slotEnd}`)
    .join('、')
})

function getInstrumentBarStyle(instrumentId) {
  const info = availabilityMap.value[instrumentId] || {}
  const total = Number(info.totalCount || 0)
  const free = Number(info.freeCount || 0)
  const used = Math.max(total - free, 0)
  const usedPercent = total > 0 ? Math.min((used / total) * 100, 100) : 0

  if (info.status === 'partial') {
    return {
      background: `linear-gradient(90deg, #f7a326 0%, #f7bf6a ${usedPercent}%, #f6ecd8 ${usedPercent}%, #f6ecd8 100%)`
    }
  }

  if (info.status === 'free') {
    return {
      background: 'linear-gradient(90deg, #cfe8d2 0%, #bfe0c4 100%)'
    }
  }

  if (info.status === 'busy' || info.status === 'locked') {
    return {
      background: 'linear-gradient(90deg, #e5e8ef 0%, #d8dee8 100%)'
    }
  }

  return {
    background: 'linear-gradient(90deg, #dfe6f1 0%, #edf2f8 100%)'
  }
}

function resetMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

function clearSelectedSlots() {
  selectedSlotIndexes.value = []
}

function clearIdentity() {
  activeIdentity.value = {
    userName: '',
    employeeNo: '',
    userKey: ''
  }
  clearSelectedSlots()
}

function isSelected(slot) {
  return selectedSlotIndexes.value.includes(slot.slotIndex)
}

function toggleSlotSelection(slot) {
  const exists = selectedSlotIndexes.value.includes(slot.slotIndex)
  if (exists) {
    selectedSlotIndexes.value = selectedSlotIndexes.value.filter((item) => item !== slot.slotIndex)
  } else {
    selectedSlotIndexes.value = [...selectedSlotIndexes.value, slot.slotIndex].sort((a, b) => a - b)
  }
}

function goToBookingInfo() {
  bookingPage.value = 1
  resetMessages()
}

async function confirmIdentityAndContinue() {
  resetMessages()

  const userName = userForm.value.userName.trim()
  const employeeNo = userForm.value.employeeNo.trim()

  activeIdentity.value = {
    userName,
    employeeNo,
    userKey: buildUserKey(userName || '__empty__', employeeNo || '__empty__')
  }

  // Save user info for auto-fill next time
  localStorage.setItem('kg7500_last_user', JSON.stringify({
    userName: activeIdentity.value.userName,
    employeeNo: activeIdentity.value.employeeNo
  }))

  bookingPage.value = 2
  successMessage.value = userName && employeeNo
    ? `已进入下一步：${userName}（工号：${employeeNo}），预约时将进行白名单校验`
    : '已进入下一步，预约时将校验姓名与工号'
  await loadSlots({ preserveMessages: true })
}

function getApplicableLocksForDate(lockRecords, targetDate) {
  return (lockRecords || []).filter((item) => {
    if (item.scopeType === 'date') return item.date === targetDate
    if (item.scopeType === 'long_term') return parseDateOnly(targetDate) >= parseDateOnly(item.startDate)
    return false
  })
}

function loadSubmissionHistory() {
  submissionHistory.value = readSubmissionLogs(deviceId.value).sort((a, b) => b.createdAt - a.createdAt)
  selectedSubmissionIds.value = []
}

function appendSubmissionLogs(logs) {
  const current = readSubmissionLogs(deviceId.value)
  writeSubmissionLogs(deviceId.value, [...logs, ...current])
  loadSubmissionHistory()
}

function toggleSubmissionSelect(id) {
  if (selectedSubmissionIds.value.includes(id)) {
    selectedSubmissionIds.value = selectedSubmissionIds.value.filter((item) => item !== id)
  } else {
    selectedSubmissionIds.value = [...selectedSubmissionIds.value, id]
  }
}

function deleteSingleSubmissionLog(id) {
  const next = readSubmissionLogs(deviceId.value).filter((item) => item.id !== id)
  writeSubmissionLogs(deviceId.value, next)
  loadSubmissionHistory()
  successMessage.value = '已删除本设备提交记录'
}

function batchDeleteSubmissionLogs() {
  if (selectedSubmissionIds.value.length === 0) {
    errorMessage.value = '请先选择要删除的记录'
    return
  }

  const next = readSubmissionLogs(deviceId.value).filter(
    (item) => !selectedSubmissionIds.value.includes(item.id)
  )
  writeSubmissionLogs(deviceId.value, next)
  loadSubmissionHistory()
  successMessage.value = '已批量删除所选记录'
}

function normalizeSystemSettingsDoc(raw) {
  const data = Array.isArray(raw) ? raw[0] || {} : raw || {}
  const rawUsers = Array.isArray(data.users) ? data.users : []
  return {
    _id: 'global',
    adminPassword: data.adminPassword ?? 'admin123',
    customSlots: normalizeSlots(Array.isArray(data.customSlots) ? data.customSlots : createDefaultSlots()),
    bookingAdvanceDays: Number(data.bookingAdvanceDays ?? 1),
    bookingOpenTime: data.bookingOpenTime ?? '17:00',
    users: rawUsers
      .map((item) => ({
        userName: String(item?.userName || '').trim(),
        employeeNo: String(item?.employeeNo || '').trim()
      }))
      .filter((item) => item.userName && item.employeeNo)
  }
}

function isSettingsNotFoundError(error) {
  const msg = error?.message || ''
  return (
    msg.includes('does not exist') ||
    msg.includes('not exist') ||
    msg.includes('不存在') ||
    msg.includes('404')
  )
}

async function readSystemSettingsDoc() {
  try {
    const res = await api.get('/settings')
    return res.data || getDefaultSettings()
  } catch (error) {
    console.warn('读取系统设置失败，使用默认设置', error)
    return getDefaultSettings()
  }
}

async function ensureSystemSettings() {
  const raw = await readSystemSettingsDoc()
  systemSettingsDocId.value = raw.recordId || raw._id || 'global'
  systemSettings.value = normalizeSystemSettingsDoc(raw)
}

async function saveSystemSettings(nextSettings) {
  const res = await api.put('/settings', {
    adminPassword: nextSettings.adminPassword,
    customSlots: nextSettings.customSlots,
    bookingAdvanceDays: nextSettings.bookingAdvanceDays,
    bookingOpenTime: nextSettings.bookingOpenTime,
    users: Array.isArray(nextSettings.users) ? nextSettings.users : []
  })

  const normalized = normalizeSystemSettingsDoc(res.data || nextSettings)

  systemSettingsDocId.value = res.data?.recordId || res.data?._id || 'global'
  systemSettings.value = normalized
}

async function loadCategories() {
  const res = await api.get('/categories')
  categories.value = res.data || []
}

async function selectCategory(category) {
  selectedCategoryId.value = category._id
  selectedCategoryName.value = category.name

  // Load category-specific settings
  const settingsRes = await api.get(`/category-settings/${category._id}`)
  categorySettings.value = settingsRes.data

  // Load category-specific custom slots for user booking view
  await loadCategoryCustomSlots(category._id)

  // Load instruments for this category
  await loadInstruments()

  showCategorySelection.value = false
}

function backToCategorySelection() {
  showCategorySelection.value = true
  selectedCategoryId.value = ''
  selectedCategoryName.value = ''
  selectedInstrumentId.value = ''
  selectedSlots.value = []
  categoryCustomSlots.value = []
}

async function loadInstruments() {
  const params = {}
  if (selectedCategoryId.value) {
    params.categoryId = selectedCategoryId.value
  }
  const res = await api.get('/instruments', { params })
  instruments.value = res.data || []

  if (!selectedInstrumentId.value && instruments.value.length > 0) {
    selectedInstrumentId.value = instruments.value[0]._id
  }

  if (
    selectedInstrumentId.value &&
    !instruments.value.some((item) => item._id === selectedInstrumentId.value) &&
    instruments.value.length > 0
  ) {
    selectedInstrumentId.value = instruments.value[0]._id
  }

  if (!adminLockForm.value.instrumentId && instruments.value.length > 0) {
    adminLockForm.value.instrumentId = instruments.value[0]._id
  }
}

async function loadCategorySettings(categoryId) {
  try {
    const res = await api.get(`/category-settings/${categoryId}`)
    return res.data || null
  } catch (error) {
    console.warn('读取类别设置失败', error)
    return null
  }
}

async function saveCategorySettings(categoryId, settings) {
  const res = await api.put(`/category-settings/${categoryId}`, settings)
  return res.data || settings
}

async function loadCategoryCustomSlots(categoryId) {
  if (!categoryId) {
    categoryCustomSlots.value = []
    return
  }
  try {
    const catSettings = await loadCategorySettings(categoryId)
    categoryCustomSlots.value = catSettings?.customSlots || []
  } catch (error) {
    categoryCustomSlots.value = []
  }
}

watch(adminSelectedCategoryId, async (newVal) => {
  if (newVal) {
    await loadCategoryCustomSlots(newVal)
  } else {
    categoryCustomSlots.value = []
  }
})

async function loadInstrumentAvailability() {
  if (instruments.value.length === 0) {
    availabilityMap.value = {}
    return
  }

  const totalCount = customSlots.value.length
  if (totalCount === 0) {
    availabilityMap.value = Object.fromEntries(
      instruments.value.map((item) => [
        item._id,
        { status: 'busy', label: '未配置', freeCount: 0, totalCount: 0, note: '请先配置时段' }
      ])
    )
    return
  }

  try {
    const today = getTodayDate()
    const params = { date: today }
    if (selectedCategoryId.value) {
      params.categoryId = selectedCategoryId.value
    }
    const [bookingRes, lockRes] = await Promise.all([
      api.get('/bookings', { params }),
      api.get('/locks', { params })
    ])
    const bookings = bookingRes.data || []
    const locks = lockRes.data || []
    const nextMap = {}

    for (const instrument of instruments.value) {
      const applicableLocks = getApplicableLocksForDate(
        locks.filter((item) => item.instrumentId === instrument._id),
        today
      )
      const dayLock = applicableLocks.find((item) => item.lockType === 'day')
      const slotLockSet = new Set(
        applicableLocks.filter((item) => item.lockType === 'slot').map((item) => item.slotIndex)
      )
      const bookingSet = new Set(
        bookings.filter((item) => item.instrumentId === instrument._id).map((item) => item.slotStart)
      )

      let freeCount = 0

      for (const slot of customSlots.value) {
        const ruleResult = getDateRuleForSlot(today, slot.slotStart)
        if (dayLock || ruleResult || slotLockSet.has(slot.slotIndex) || bookingSet.has(slot.slotStart)) {
          continue
        }
        freeCount += 1
      }

      let status = 'free'
      let label = '可用'
      let note = '当前空闲'

      if (dayLock) {
        status = 'busy'
        label = '锁定'
        note = '当天锁定'
      } else if (freeCount === 0) {
        status = 'busy'
        label = '已满'
        note = '暂无可约'
      } else if (freeCount < totalCount) {
        status = 'partial'
        label = '部分可用'
        note = `剩余 ${freeCount}/${totalCount}`
      }

      nextMap[instrument._id] = {
        status,
        label,
        note,
        freeCount,
        totalCount
      }
    }

    availabilityMap.value = nextMap
  } catch (error) {
    console.error(error)
  }
}

async function loadAdminBookingRecords() {
  if (!adminAuthed.value) {
    bookingRecords.value = []
    return
  }

  const params = { date: selectedDate.value }
  if (selectedCategoryId.value) {
    params.categoryId = selectedCategoryId.value
  }
  const res = await api.get('/bookings', { params })

  bookingRecords.value = (res.data || []).sort((a, b) => {
    const aKey = `${a.instrumentName || ''}_${a.slotStart || ''}`
    const bKey = `${b.instrumentName || ''}_${b.slotStart || ''}`
    return aKey.localeCompare(bKey)
  })
}

async function initPage() {
  loading.value = true
  resetMessages()

  try {
    await ensureSystemSettings()
    await loadCategories()
    await loadInstruments()
    loadSubmissionHistory()
    await Promise.all([loadSlots(), loadInstrumentAvailability()])
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '初始化失败')
  } finally {
    loading.value = false
  }
}

async function loadSlots(options = {}) {
  const { preserveMessages = false } = options

  if (!selectedInstrumentId.value || !selectedDate.value) {
    slots.value = []
    return
  }

  loading.value = true
  if (!preserveMessages) resetMessages()
  clearSelectedSlots()

  try {
    const baseSlots = customSlots.value.map((slot) => ({
      ...slot,
      status: 'available',
      text: '可预约',
      userName: '',
      bookingId: '',
      remark: ''
    }))

    const slotParams = {
      date: selectedDate.value,
      instrumentId: selectedInstrumentId.value
    }
    if (selectedCategoryId.value) {
      slotParams.categoryId = selectedCategoryId.value
    }
    const [bookingRes, lockRes] = await Promise.all([
      api.get('/bookings', { params: slotParams }),
      api.get('/locks', { params: slotParams })
    ])
    const bookings = bookingRes.data || []
    currentLocks.value = lockRes.data || []

    const applicableLocks = getApplicableLocksForDate(currentLocks.value, selectedDate.value)
    const dayLock = applicableLocks.find((item) => item.lockType === 'day')

    const slotLockMap = {}
    applicableLocks
      .filter((item) => item.lockType === 'slot')
      .forEach((item) => {
        slotLockMap[item.slotIndex] = item
      })

    slots.value = baseSlots.map((slot) => {
      if (dayLock) {
        return { ...slot, status: 'locked', text: '整天锁定' }
      }

      const ruleResult = getDateRuleForSlot(selectedDate.value, slot.slotStart)
      if (ruleResult) {
        return { ...slot, status: ruleResult.status, text: ruleResult.text }
      }

      if (slotLockMap[slot.slotIndex]) {
        return { ...slot, status: 'locked', text: '时段锁定' }
      }

      const matchedBooking = bookings.find((item) => item.slotStart === slot.slotStart)
      if (matchedBooking) {
        const isMine = matchedBooking.userKey === currentUserKey.value
        return {
          ...slot,
          bookingId: matchedBooking._id || matchedBooking.recordId,
          recordId: matchedBooking.recordId || matchedBooking._id,
          userKey: matchedBooking.userKey || '',
          userName: matchedBooking.userName || '',
          employeeNo: matchedBooking.employeeNo || '',
          remark: matchedBooking.remark || '',
          status: isMine ? 'mine' : 'booked',
          text: isMine ? '我的预约' : '已占用'
        }
      }

      return { ...slot, status: 'available', text: '可预约' }
    })

    if (adminAuthed.value && activeTab.value === 'admin' && adminTab.value === 'record') {
      await loadAdminBookingRecords()
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '读取预约数据失败')
  } finally {
    loading.value = false
  }
}

function handleSlotClick(slot) {
  resetMessages()

  if (!identityReady.value) {
    errorMessage.value = '请先填写并确认用户信息'
    return
  }

  if (slot.status === 'locked' || slot.status === 'expired' || slot.status === 'booked') return
  toggleSlotSelection(slot)
}

async function reserveSelectedSlots() {
  if (!identityReady.value) {
    errorMessage.value = '请先确认身份'
    return
  }

  if (selectedSlotsForOperation.value.length === 0) {
    errorMessage.value = '请先选择至少一个时段'
    return
  }

  // 用户白名单校验：失败 → 退回到姓名/工号输入页
  const userName = (activeIdentity.value.userName || '').trim()
  const employeeNo = (activeIdentity.value.employeeNo || '').trim()
  const isWhitelisted = registeredUsers.value.some(
    (user) => user.userName === userName && user.employeeNo === employeeNo
  )

  if (!userName || !employeeNo || !isWhitelisted) {
    errorMessage.value = '预约失败：该姓名与工号未注册，请联系管理员添加'
    bookingPage.value = 1
    clearIdentity()
    return
  }

  const hasUnavailableSelected = selectedSlotsForOperation.value.some((slot) => {
    const ruleResult = getDateRuleForSlot(selectedDate.value, slot.slotStart)
    return !!ruleResult
  })

  if (hasUnavailableSelected) {
    errorMessage.value = '当前选中的时段不在可预约范围内，请重新选择'
    await loadSlots()
    await loadInstrumentAvailability()
    return
  }

  operating.value = true
  resetMessages()

  try {
    const lockParams = {
      date: selectedDate.value,
      instrumentId: selectedInstrumentId.value
    }
    if (selectedCategoryId.value) {
      lockParams.categoryId = selectedCategoryId.value
    }
    const lockRes = await api.get('/locks', { params: lockParams })

    const applicableLocks = getApplicableLocksForDate(lockRes.data || [], selectedDate.value)
    const hasDayLock = applicableLocks.some((item) => item.lockType === 'day')
    if (hasDayLock) {
      errorMessage.value = '该仪器当天已被整天锁定，无法预约'
      await loadSlots()
      await loadInstrumentAvailability()
      return
    }

    const slotLockIndexes = new Set(
      applicableLocks.filter((item) => item.lockType === 'slot').map((item) => item.slotIndex)
    )

    const selectedHasSlotLock = selectedSlotsForOperation.value.some((slot) => slotLockIndexes.has(slot.slotIndex))
    if (selectedHasSlotLock) {
      errorMessage.value = '选中的部分时段已被管理员锁定'
      await loadSlots()
      await loadInstrumentAvailability()
      return
    }

    const bookingParams = {
      date: selectedDate.value,
      instrumentId: selectedInstrumentId.value
    }
    if (selectedCategoryId.value) {
      bookingParams.categoryId = selectedCategoryId.value
    }
    const bookingRes = await api.get('/bookings', { params: bookingParams })

    const activeBookings = bookingRes.data || []
    const remark = userForm.value.remark.trim()

    let overwriteCount = 0
    const newlyCreated = []

    for (const slot of selectedSlotsForOperation.value) {
      const existed = activeBookings.find((item) => item.slotStart === slot.slotStart)

      if (existed) {
        overwriteCount += 1
        continue
      }

      const createRes = await api.post('/bookings', {
        date: selectedDate.value,
        instrumentId: selectedInstrumentId.value,
        instrumentName: selectedInstrumentName.value,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        slotIndex: slot.slotIndex,
        userName: activeIdentity.value.userName,
        employeeNo: activeIdentity.value.employeeNo,
        remark,
        categoryId: selectedCategoryId.value
      })

      newlyCreated.push({
        slot,
        record: createRes.data
      })
    }

    let successCount = 0
    let conflictCount = 0
    const localLogs = []

    for (const { slot, record } of newlyCreated) {
      const checkParams = {
        date: selectedDate.value,
        instrumentId: selectedInstrumentId.value,
        slotStart: slot.slotStart
      }
      if (selectedCategoryId.value) {
        checkParams.categoryId = selectedCategoryId.value
      }
      const checkRes = await api.get('/bookings', { params: checkParams })
      const slotBookings = (checkRes.data || []).filter((b) => b.slotStart === slot.slotStart)

      if (slotBookings.length <= 1) {
        successCount += 1
        localLogs.push({
          id: createLogId(),
          actionType: 'reserve',
          date: selectedDate.value,
          instrumentId: selectedInstrumentId.value,
          instrumentName: selectedInstrumentName.value,
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
          userName: activeIdentity.value.userName,
          employeeNo: activeIdentity.value.employeeNo,
          remark,
          createdAt: Date.now()
        })
        continue
      }

      slotBookings.sort((a, b) => {
        const idA = Number(a.recordId || a._id || a.id || 0)
        const idB = Number(b.recordId || b._id || b.id || 0)
        return idA - idB
      })

      const myId = record.recordId || record._id || record.id
      const myIndex = slotBookings.findIndex((b) => (b.recordId || b._id || b.id) === myId)

      if (myIndex === 0) {
        successCount += 1
        localLogs.push({
          id: createLogId(),
          actionType: 'reserve',
          date: selectedDate.value,
          instrumentId: selectedInstrumentId.value,
          instrumentName: selectedInstrumentName.value,
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
          userName: activeIdentity.value.userName,
          employeeNo: activeIdentity.value.employeeNo,
          remark,
          createdAt: Date.now()
        })
        for (let i = 1; i < slotBookings.length; i++) {
          const dupId = slotBookings[i].recordId || slotBookings[i]._id || slotBookings[i].id
          if (dupId) {
            try {
              await api.delete(`/bookings/${encodeURIComponent(dupId)}`)
            } catch (e) {
              console.warn('清理重复预约失败', e)
            }
          }
        }
      } else {
        conflictCount += 1
        if (myId) {
          try {
            await api.delete(`/bookings/${encodeURIComponent(myId)}`)
          } catch (e) {
            console.warn('删除冲突预约失败', e)
          }
        }
      }
    }

    appendSubmissionLogs(localLogs)

    if (successCount > 0 && conflictCount > 0) {
      successMessage.value = `预约完成：成功 ${successCount} 个时段，手慢了 ${conflictCount} 个时段被抢走。`
    } else if (successCount > 0 && overwriteCount > 0) {
      successMessage.value = `预约完成：成功 ${successCount} 个时段，跳过已占用 ${overwriteCount} 个。`
    } else if (conflictCount > 0 && successCount === 0) {
      errorMessage.value = `预约失败：${conflictCount} 个时段都被抢走了，再试试其他时段吧！`
    } else if (overwriteCount > 0 && successCount === 0) {
      errorMessage.value = `选中的 ${overwriteCount} 个时段都已被占用。`
    } else {
      successMessage.value = `预约成功：已预约 ${successCount} 个时段。`
    }

    await loadSlots({ preserveMessages: true })
    await loadInstrumentAvailability()
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '预约失败')
  } finally {
    operating.value = false
  }
}

async function cancelSelectedSlots() {
  if (!identityReady.value) {
    errorMessage.value = '请先确认身份'
    return
  }

  if (selectedSlotsForOperation.value.length === 0) {
    errorMessage.value = '请先选择要取消的时段'
    return
  }

  operating.value = true
  resetMessages()

  try {
    const cancelParams = {
      date: selectedDate.value,
      instrumentId: selectedInstrumentId.value
    }
    if (selectedCategoryId.value) {
      cancelParams.categoryId = selectedCategoryId.value
    }
    const bookingRes = await api.get('/bookings', { params: cancelParams })

    const activeBookings = bookingRes.data || []

    let cancelledCount = 0
    let unchangedOtherCount = 0
    let unchangedPastCount = 0
    let unchangedEmptyCount = 0
    const localLogs = []

    for (const slot of selectedSlotsForOperation.value) {
      const existed = activeBookings.find((item) => item.slotStart === slot.slotStart)

      if (!existed) {
        unchangedEmptyCount += 1
        continue
      }

      if (isPastSlot(selectedDate.value, slot.slotStart)) {
        unchangedPastCount += 1
        continue
      }

      if (existed.userKey !== activeIdentity.value.userKey) {
        unchangedOtherCount += 1
        continue
      }

      const recordId = existed.recordId || existed._id
      if (!recordId) {
        unchangedEmptyCount += 1
        continue
      }

      await api.delete(`/bookings/${encodeURIComponent(recordId)}`)
      localLogs.push({
        id: createLogId(),
        actionType: 'cancel',
        date: selectedDate.value,
        instrumentId: selectedInstrumentId.value,
        instrumentName: selectedInstrumentName.value,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        userName: activeIdentity.value.userName,
        employeeNo: activeIdentity.value.employeeNo,
        remark: existed.remark || '',
        createdAt: Date.now()
      })
      cancelledCount += 1
    }

    if (localLogs.length > 0) {
      appendSubmissionLogs(localLogs)
    }

    const summary = []
    if (cancelledCount > 0) summary.push(`已取消 ${cancelledCount} 个`)
    if (unchangedEmptyCount > 0) summary.push(`空白未变 ${unchangedEmptyCount} 个`)
    if (unchangedOtherCount > 0) summary.push(`他人预约未变 ${unchangedOtherCount} 个`)
    if (unchangedPastCount > 0) summary.push(`已开始未变 ${unchangedPastCount} 个`)

    successMessage.value = summary.length > 0 ? `取消处理完成：${summary.join('，')}。` : '未发生变更。'

    await loadSlots({ preserveMessages: true })
    await loadInstrumentAvailability()
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '取消预约失败')
  } finally {
    operating.value = false
  }
}

function switchTab(tab) {
  activeTab.value = tab
  resetMessages()

  if (tab === 'submission') {
    loadSubmissionHistory()
  }

  if (tab === 'admin') {
    loadCategories()
  }

  if (tab === 'admin' && adminAuthed.value && adminTab.value === 'record') {
    loadAdminBookingRecords()
  }
}

function formatDateText(dateStr) {
  const { monthDay, weekday } = getDateLabel(dateStr)
  return `${monthDay} ${weekday}`
}

function getSlotPersonName(slot) {
  if (!slot.userName) return ''
  return slot.employeeNo ? `${slot.userName}；${slot.employeeNo}` : slot.userName
}

async function confirmAdmin() {
  resetMessages()
  if (!adminLoginForm.value.password) {
    errorMessage.value = '请输入管理员密码'
    return
  }

  if (adminLoginForm.value.password !== systemSettings.value.adminPassword) {
    errorMessage.value = '管理员密码错误'
    return
  }

  adminAuthed.value = true
  successMessage.value = '已进入管理员模式'
  if (adminTab.value === 'record') {
    await loadAdminBookingRecords()
  }
}

function logoutAdmin() {
  adminAuthed.value = false
  adminLoginForm.value.password = ''
  adminPasswordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
  bookingRecords.value = []
  successMessage.value = '已退出管理员模式'
}

async function changeAdminPassword() {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }

  resetMessages()
  const currentPassword = adminPasswordForm.value.currentPassword.trim()
  const newPassword = adminPasswordForm.value.newPassword.trim()
  const confirmPassword = adminPasswordForm.value.confirmPassword.trim()

  if (!currentPassword || !newPassword || !confirmPassword) {
    errorMessage.value = '请完整填写当前密码、新密码和确认密码'
    return
  }

  if (currentPassword !== systemSettings.value.adminPassword) {
    errorMessage.value = '当前密码不正确'
    return
  }

  if (newPassword.length < 4) {
    errorMessage.value = '新密码至少需要 4 位'
    return
  }

  if (newPassword !== confirmPassword) {
    errorMessage.value = '两次输入的新密码不一致'
    return
  }

  const confirmed = window.confirm('确定要修改管理员密码吗？修改后请使用新密码登录。')
  if (!confirmed) return

  operating.value = true
  try {
    await saveSystemSettings({
      ...systemSettings.value,
      adminPassword: newPassword
    })
    adminLoginForm.value.password = newPassword
    adminPasswordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
    successMessage.value = '管理员密码修改成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '修改管理员密码失败')
  } finally {
    operating.value = false
  }
}

async function saveBookingSettings() {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }
  resetMessages()
  const advanceDays = Number(adminBookingForm.value.advanceDays)
  const openTime = (adminBookingForm.value.openTime || '').trim()
  if (!advanceDays || advanceDays < 1 || !Number.isFinite(advanceDays)) {
    errorMessage.value = '预约开放天数至少为 1'
    return
  }
  if (!openTime) {
    errorMessage.value = '请选择预约开放时间'
    return
  }
  operating.value = true
  try {
    await saveSystemSettings({
      ...systemSettings.value,
      bookingAdvanceDays: advanceDays,
      bookingOpenTime: openTime
    })
    successMessage.value = '预约设置保存成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '保存预约设置失败')
  } finally {
    operating.value = false
  }
}

async function batchAddRegisteredUsers() {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }
  resetMessages()
  const lines = batchUserInput.value.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    errorMessage.value = '请输入要批量新增的用户'
    return
  }
  const newUsers = []
  const errors = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split(/[\s,，]+/).filter(Boolean)
    if (parts.length < 2) {
      errors.push(`第 ${i + 1} 行格式错误：${line}`)
      continue
    }
    const userName = parts[0].trim()
    const employeeNo = parts[1].trim()
    if (!userName || !employeeNo) {
      errors.push(`第 ${i + 1} 行姓名或工号为空`)
      continue
    }
    const existed = registeredUsers.value.some(
      (item) => item.userName === userName && item.employeeNo === employeeNo
    )
    if (existed) {
      errors.push(`第 ${i + 1} 行用户已存在：${userName}（${employeeNo}）`)
      continue
    }
    newUsers.push({ userName, employeeNo })
  }
  if (newUsers.length === 0) {
    errorMessage.value = errors.length > 0 ? errors.join('；') : '没有可新增的有效用户'
    return
  }
  operating.value = true
  try {
    await saveSystemSettings({
      ...systemSettings.value,
      users: [...registeredUsers.value, ...newUsers]
    })
    batchUserInput.value = ''
    successMessage.value = `成功新增 ${newUsers.length} 位用户${errors.length > 0 ? '，' + errors.length + ' 行跳过' : ''}`
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '批量新增用户失败')
  } finally {
    operating.value = false
  }
}

async function batchDeleteRegisteredUsers() {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }
  resetMessages()
  const keys = selectedUserKeys.value
  if (keys.length === 0) {
    errorMessage.value = '请先选择要删除的用户'
    return
  }
  const confirmed = window.confirm(`确定删除选中的 ${keys.length} 位用户吗？`)
  if (!confirmed) return
  operating.value = true
  try {
    const keySet = new Set(keys)
    await saveSystemSettings({
      ...systemSettings.value,
      users: registeredUsers.value.filter(
        (u) => !keySet.has(`${u.userName}-${u.employeeNo}`)
      )
    })
    selectedUserKeys.value = []
    successMessage.value = '批量删除用户成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '批量删除用户失败')
  } finally {
    operating.value = false
  }
}

async function addCustomSlot() {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }

  resetMessages()
  const slotStart = adminSlotForm.value.slotStart
  const slotEnd = adminSlotForm.value.slotEnd

  if (!isValidTimeText(slotStart) || !isValidTimeText(slotEnd)) {
    errorMessage.value = '请选择正确的开始时间和结束时间'
    return
  }

  if (slotStart >= slotEnd) {
    errorMessage.value = '结束时间必须晚于开始时间'
    return
  }

  const existed = customSlots.value.some((item) => item.slotStart === slotStart && item.slotEnd === slotEnd)
  if (existed) {
    errorMessage.value = '该时间段已存在'
    return
  }

  const nextSlots = normalizeSlots([
    ...customSlots.value,
    {
      slotStart,
      slotEnd
    }
  ])

  operating.value = true
  try {
    if (adminSelectedCategoryId.value) {
      const catSettings = await loadCategorySettings(adminSelectedCategoryId.value)
      const nextCatSlots = normalizeSlots([
        ...(catSettings?.customSlots || []),
        { slotStart, slotEnd }
      ])
      await saveCategorySettings(adminSelectedCategoryId.value, {
        ...catSettings,
        customSlots: nextCatSlots
      })
      await loadCategoryCustomSlots(adminSelectedCategoryId.value)
    } else {
      await saveSystemSettings({
        ...systemSettings.value,
        customSlots: nextSlots
      })
    }
    await loadSlots({ preserveMessages: true })
    await loadInstrumentAvailability()
    successMessage.value = '新增时间段成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '新增时间段失败')
  } finally {
    operating.value = false
  }
}

async function deleteCustomSlot(slot) {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }

  const confirmed = window.confirm(`确定删除时间段 ${slot.slotStart}-${slot.slotEnd} 吗？`)
  if (!confirmed) return

  resetMessages()
  const nextSlots = customSlots.value.filter((item) => item.slotIndex !== slot.slotIndex)

  operating.value = true
  try {
    if (adminSelectedCategoryId.value) {
      const catSettings = await loadCategorySettings(adminSelectedCategoryId.value)
      const nextCatSlots = normalizeSlots(
        (catSettings?.customSlots || []).filter((item) => !(item.slotStart === slot.slotStart && item.slotEnd === slot.slotEnd))
      )
      await saveCategorySettings(adminSelectedCategoryId.value, {
        ...catSettings,
        customSlots: nextCatSlots
      })
      await loadCategoryCustomSlots(adminSelectedCategoryId.value)
    } else {
      await saveSystemSettings({
        ...systemSettings.value,
        customSlots: nextSlots
      })
    }
    selectedSlotIndexes.value = []
    adminLockForm.value.slotIndexes = adminLockForm.value.slotIndexes.filter((index) =>
      nextSlots.some((item) => item.slotIndex === index)
    )
    await loadSlots({ preserveMessages: true })
    await loadInstrumentAvailability()
    successMessage.value = '删除时间段成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '删除时间段失败')
  } finally {
    operating.value = false
  }
}

async function addCategory() {
  const name = adminCategoryForm.value.name.trim()
  if (!name) return
  await api.post('/categories', { name, icon: adminCategoryForm.value.icon })
  adminCategoryForm.value = { name: '', icon: '' }
  await loadCategories()
}

async function deleteCategory(item) {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }
  const confirmed = window.confirm(`确定删除类别"${item.name}"吗？该类别下的所有仪器和预约记录也会被删除。`)
  if (!confirmed) return
  resetMessages()
  operating.value = true
  try {
    await api.delete(`/categories/${item._id}`)
    await loadCategories()
    successMessage.value = '删除类别成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '删除类别失败')
  } finally {
    operating.value = false
  }
}

async function addInstrument() {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }

  if (!adminSelectedCategoryId.value) {
    errorMessage.value = '请先选择类别'
    return
  }

  resetMessages()
  const name = adminInstrumentForm.value.name.trim()
  const remark = adminInstrumentForm.value.remark.trim()

  if (!name) {
    errorMessage.value = '请输入仪器名称'
    return
  }

  if (filteredInstruments.value.some((item) => item.name === name)) {
    errorMessage.value = '仪器名称已存在'
    return
  }

  operating.value = true
  try {
    await api.post('/instruments', {
      name,
      remark,
      categoryId: adminSelectedCategoryId.value
    })

    adminInstrumentForm.value = { name: '', remark: '' }
    await loadInstruments()
    await loadInstrumentAvailability()
    successMessage.value = '新增仪器成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '新增仪器失败')
  } finally {
    operating.value = false
  }
}

async function deleteInstrument(item) {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }

  const confirmed = window.confirm(`确定删除仪器“${item.name}”吗？`)
  if (!confirmed) return

  resetMessages()
  operating.value = true
  try {
    const recordId = item.recordId || item._id
    await api.delete(`/instruments/${encodeURIComponent(recordId)}`)
    await loadInstruments()
    await loadSlots({ preserveMessages: true })
    await loadInstrumentAvailability()
    successMessage.value = '删除仪器成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '删除仪器失败')
  } finally {
    operating.value = false
  }
}

async function addRegisteredUser() {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }
  resetMessages()
  const userName = adminUserForm.value.userName.trim()
  const employeeNo = adminUserForm.value.employeeNo.trim()
  if (!userName) {
    errorMessage.value = '请输入姓名'
    return
  }
  if (!employeeNo) {
    errorMessage.value = '请输入工号'
    return
  }

  const existed = registeredUsers.value.some(
    (item) => item.userName === userName && item.employeeNo === employeeNo
  )
  if (existed) {
    errorMessage.value = '该用户已存在'
    return
  }

  operating.value = true
  try {
    await saveSystemSettings({
      ...systemSettings.value,
      users: [...registeredUsers.value, { userName, employeeNo }]
    })
    adminUserForm.value = { userName: '', employeeNo: '' }
    successMessage.value = '新增用户成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '新增用户失败')
  } finally {
    operating.value = false
  }
}

async function deleteRegisteredUser(item) {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }
  const confirmed = window.confirm(`确定删除用户「${item.userName}（工号：${item.employeeNo}）」吗？`)
  if (!confirmed) return
  resetMessages()
  operating.value = true
  try {
    await saveSystemSettings({
      ...systemSettings.value,
      users: registeredUsers.value.filter(
        (u) => !(u.userName === item.userName && u.employeeNo === item.employeeNo)
      )
    })
    successMessage.value = '删除用户成功'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '删除用户失败')
  } finally {
    operating.value = false
  }
}

function addAdminLockDate() {
  resetMessages()
  const date = adminLockForm.value.dateInput
  if (!date) {
    errorMessage.value = '请先选择日期'
    return
  }

  if (!adminLockForm.value.dates.includes(date)) {
    adminLockForm.value.dates = [...adminLockForm.value.dates, date].sort()
  }
}

function removeAdminLockDate(date) {
  adminLockForm.value.dates = adminLockForm.value.dates.filter((item) => item !== date)
}

function toggleAdminLockSlot(slotIndex) {
  const exists = adminLockForm.value.slotIndexes.includes(slotIndex)
  if (exists) {
    adminLockForm.value.slotIndexes = adminLockForm.value.slotIndexes.filter((item) => item !== slotIndex)
  } else {
    adminLockForm.value.slotIndexes = [...adminLockForm.value.slotIndexes, slotIndex].sort((a, b) => a - b)
  }
}

function buildAdminLockTargets() {
  const result = []

  for (const date of adminLockForm.value.dates) {
    result.push({
      scopeType: 'date',
      date,
      startDate: ''
    })
  }

  if (adminLockForm.value.longTerm) {
    result.push({
      scopeType: 'long_term',
      date: '',
      startDate: adminLockForm.value.dateInput
    })
  }

  return result
}

function buildAdminLockSlotTargets() {
  if (adminLockForm.value.slotIndexes.length === 0) {
    return [
      {
        lockType: 'day',
        slotIndex: -1,
        slotStart: '',
        slotEnd: ''
      }
    ]
  }

  return adminLockForm.value.slotIndexes
    .map((slotIndex) => {
      const slot = customSlots.value.find((item) => item.slotIndex === slotIndex)
      if (!slot) return null
      return {
        lockType: 'slot',
        slotIndex: slot.slotIndex,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd
      }
    })
    .filter(Boolean)
}

async function applyLockAction(action) {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }

  resetMessages()

  const instrumentId = adminLockForm.value.instrumentId
  const instrument = filteredInstruments.value.find((item) => item._id === instrumentId)
    || instruments.value.find((item) => item._id === instrumentId)
  if (!instrumentId || !instrument) {
    errorMessage.value = '请先选择仪器'
    return
  }

  const targets = buildAdminLockTargets()
  if (targets.length === 0) {
    errorMessage.value = '请至少选择一个日期，或勾选长期'
    return
  }

  const slotTargets = buildAdminLockSlotTargets()
  const reason = adminLockForm.value.reason.trim()

  operating.value = true
  try {
    const adminLockParams = { instrumentId }
    if (selectedCategoryId.value) {
      adminLockParams.categoryId = selectedCategoryId.value
    }
    const existingRes = await api.get('/locks', { params: adminLockParams })

    const existingLocks = existingRes.data || []

    if (action === 'lock') {
      let addCount = 0
      for (const target of targets) {
        for (const slotTarget of slotTargets) {
          const existed = existingLocks.find((item) => {
            return (
              item.instrumentId === instrumentId &&
              item.scopeType === target.scopeType &&
              (target.scopeType === 'date' ? item.date === target.date : item.startDate === target.startDate) &&
              item.lockType === slotTarget.lockType &&
              item.slotIndex === slotTarget.slotIndex
            )
          })

          if (existed) continue

          await api.post('/locks', {
            instrumentId,
            instrumentName: instrument.name,
            scopeType: target.scopeType,
            date: target.date,
            startDate: target.startDate,
            lockType: slotTarget.lockType,
            slotIndex: slotTarget.slotIndex,
            slotStart: slotTarget.slotStart,
            slotEnd: slotTarget.slotEnd,
            reason,
            createdBy: 'admin_local',
            createdByName: '管理员',
            categoryId: selectedCategoryId.value
          })

          addCount += 1
        }
      }

      successMessage.value = addCount > 0 ? `锁定成功，共新增 ${addCount} 条记录。` : '没有新增锁定记录。'
    }

    if (action === 'unlock') {
      let removeCount = 0
      for (const lock of existingLocks) {
        const targetMatched = targets.some((target) => {
          if (target.scopeType !== lock.scopeType) return false
          if (target.scopeType === 'date') return lock.date === target.date
          return lock.startDate === target.startDate
        })
        if (!targetMatched) continue

        const slotMatched = slotTargets.some((slotTarget) => {
          return lock.lockType === slotTarget.lockType && lock.slotIndex === slotTarget.slotIndex
        })
        if (!slotMatched) continue

        const recordId = lock.recordId || lock._id
        if (!recordId) continue

        await api.delete(`/locks/${encodeURIComponent(recordId)}`)
        removeCount += 1
      }

      successMessage.value = removeCount > 0 ? `解锁成功，共删除 ${removeCount} 条记录。` : '没有找到可解锁记录。'
    }

    await loadSlots({ preserveMessages: true })
    await loadInstrumentAvailability()
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, action === 'lock' ? '锁定失败' : '解锁失败')
  } finally {
    operating.value = false
  }
}

async function deleteBookingByAdmin(record) {
  if (!adminAuthed.value) {
    errorMessage.value = '请先进入管理员模式'
    return
  }

  const confirmed = window.confirm(
    `确定删除 ${record.userName} 在 ${record.instrumentName} ${record.slotStart}-${record.slotEnd} 的预约吗？`
  )
  if (!confirmed) return

  resetMessages()
  operating.value = true
  try {
    const recordId = record.recordId || record._id
    await api.delete(`/bookings/${encodeURIComponent(recordId)}`)
    await loadSlots({ preserveMessages: true })
    await loadInstrumentAvailability()
    successMessage.value = '已删除预约记录'
  } catch (error) {
    console.error(error)
    errorMessage.value = friendlyError(error, '删除预约记录失败')
  } finally {
    operating.value = false
  }
}

watch(
  () => [userForm.value.userName, userForm.value.employeeNo],
  ([newName, newNo]) => {
    const changed =
      newName.trim() !== activeIdentity.value.userName ||
      newNo.trim() !== activeIdentity.value.employeeNo

    if (changed && identityReady.value) {
      clearIdentity()
    }
  }
)

watch([selectedDate, selectedInstrumentId], async () => {
  if (!selectedDate.value) return
  if (selectedInstrumentId.value) {
    await loadSlots()
  }
  await loadInstrumentAvailability()
  if (adminAuthed.value && activeTab.value === 'admin' && adminTab.value === 'record') {
    await loadAdminBookingRecords()
  }
})

watch(activeTab, async (tab) => {
  if (tab === 'submission') {
    loadSubmissionHistory()
  }
  if (tab === 'admin' && adminAuthed.value && adminTab.value === 'record') {
    await loadAdminBookingRecords()
  }
})

watch(adminTab, async (tab) => {
  if (tab === 'record' && adminAuthed.value && activeTab.value === 'admin') {
    await loadAdminBookingRecords()
  }
  if (tab === 'setting') {
    adminBookingForm.value = {
      advanceDays: systemSettings.value.bookingAdvanceDays || 1,
      openTime: systemSettings.value.bookingOpenTime || '17:00'
    }
  }
  if (tab === 'user') {
    selectedUserKeys.value = []
  }
})

onMounted(() => {
  // Auto-fill saved user info
  try {
    const saved = JSON.parse(localStorage.getItem('kg7500_last_user'))
    if (saved) {
      userForm.value.userName = saved.userName || ''
      userForm.value.employeeNo = saved.employeeNo || ''
    }
  } catch {}

  initPage()
})
</script>

<template>
  <div class="mobile-shell">
    <div class="mobile-bg bg-1"></div>
    <div class="mobile-bg bg-2"></div>

    <div class="app-phone">
      <header class="app-header">
        <div>
          <div class="title-main">科研仪器预约系统</div>
          <div class="title-sub">KG-7500 设备预约</div>
        </div>
      </header>

      <div class="page-content">
        <transition name="tab-fade" mode="out-in">
          <section v-if="activeTab === 'booking'" key="booking" class="panel-section">
            <div class="step-bar card-surface">
              <div
                v-for="item in stepItems"
                :key="item.step"
                class="step-item"
                :class="{
                  done: bookingFlowStep > item.step,
                  active: bookingFlowStep === item.step
                }"
              >
                <div class="step-circle">
                  <span v-if="bookingFlowStep > item.step">✓</span>
                  <span v-else>{{ item.step }}</span>
                </div>
                <div class="step-line" v-if="item.step < stepItems.length"></div>
                <div class="step-label">{{ item.label }}</div>
              </div>
            </div>

            <transition name="booking-swap" mode="out-in">
              <div v-if="bookingPage === 1" key="page-1" class="booking-page">
                <div class="hero-card card-surface">
                  <div class="section-head">
                    <h2>填写用户信息</h2>
                    <span class="badge-primary">请先完成身份验证</span>
                  </div>

                  <div class="field-block">
                    <label>姓名（预约时校验）</label>
                    <input
                      v-model="userForm.userName"
                      type="text"
                      placeholder="请输入姓名（预约时校验）"
                      @keydown.enter.prevent="confirmIdentityAndContinue"
                    />
                  </div>

                  <div class="field-block">
                    <label>工号（预约时校验）</label>
                    <input
                      v-model="userForm.employeeNo"
                      type="text"
                      placeholder="请输入工号"
                      @keydown.enter.prevent="confirmIdentityAndContinue"
                    />
                  </div>

                  <div class="field-block">
                    <label>备注（选填）</label>
                    <textarea
                      v-model="userForm.remark"
                      rows="4"
                      maxlength="50"
                      placeholder="如：实验项目名称、用途等"
                    ></textarea>
                    <div class="field-meta">{{ userForm.remark.length }}/50</div>
                  </div>

                  <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
                  <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

                  <button class="primary-btn full-btn" type="button" @click="confirmIdentityAndContinue">
                    确认并继续
                  </button>
                </div>

                <!-- Category Selection -->
                <div v-if="showCategorySelection" class="category-selection card-surface">
                  <div class="section-head">
                    <h3>选择仪器类别</h3>
                    <span class="mini-tip">左右滑动查看更多</span>
                  </div>
                  <div class="category-scroll">
                    <div class="category-list">
                      <button
                        v-for="cat in categories"
                        :key="cat._id"
                        class="category-card"
                        type="button"
                        @click="selectCategory(cat)"
                      >
                        <div class="category-icon">{{ cat.icon || '📱' }}</div>
                        <div class="category-name">{{ cat.name }}</div>
                      </button>
                    </div>
                  </div>
                </div>

                <div v-if="!showCategorySelection" class="category-summary card-surface compact-card">
                  <div class="section-head">
                    <h3>已选类别</h3>
                    <button class="ghost-btn" type="button" @click="backToCategorySelection">返回选择</button>
                  </div>
                  <div class="category-selected-info">
                    <span class="category-icon">{{ categories.find(c => c._id === selectedCategoryId)?.icon || '📱' }}</span>
                    <span class="category-name">{{ selectedCategoryName }}</span>
                  </div>
                </div>

                <div class="overview-card card-surface">
                  <div class="section-head">
                    <h3>实时可用概览</h3>
                    <span class="overview-time">按 {{ formatDateText(getTodayDate()) }} 统计</span>
                  </div>

                  <div v-if="overviewList.length === 0" class="empty-text">
                    当前没有读取到仪器，请先检查 `instruments` 集合数据。
                  </div>

                  <div v-for="item in overviewList" :key="item._id" class="overview-row">
                    <div class="thumb" :class="item.status"></div>
                    <div class="overview-main">
                      <div class="overview-title">{{ item.name }}</div>
                      <div class="overview-sub">
                        <span class="status-dot" :class="item.status"></span>
                        {{ item.label }}
                      </div>
                    </div>
                    <div class="overview-bars">
                      <span
                        v-for="index in 5"
                        :key="index"
                        class="bar"
                        :class="{
                          active: index <= Math.ceil(((item.freeCount || 0) / Math.max(item.totalCount || 1, 1)) * 5),
                          [item.status]: true
                        }"
                      ></span>
                    </div>
                    <div class="overview-count">{{ item.freeCount }}/{{ item.totalCount }}</div>
                  </div>
                </div>
              </div>

              <div v-else key="page-2" class="booking-page">
                <div class="summary-card card-surface">
                  <div class="summary-top">
                    <div>
                      <div class="summary-title">已确认用户</div>
                      <div class="summary-name">{{ identityText }}</div>
                    </div>
                    <button class="ghost-btn" type="button" @click="goToBookingInfo">修改信息</button>
                  </div>
                  <div class="summary-remark" v-if="userForm.remark.trim()">备注：{{ userForm.remark.trim() }}</div>
                  <div class="summary-remark" v-if="selectedCategoryName">类别：{{ selectedCategoryName }}</div>
                </div>

                <div class="card-surface choose-card compact-card">
                  <div class="section-head">
                    <h3>选择仪器</h3>
                    <span class="mini-tip">点击卡片切换</span>
                  </div>

                  <div v-if="instruments.length === 0" class="empty-text">
                    当前没有可预约仪器，请先在管理员面板中添加。
                  </div>

                  <div v-else class="instrument-list two-column">
                    <button
                      v-for="item in instruments"
                      :key="item._id"
                      class="instrument-card"
                      :class="{
                        active: selectedInstrumentId === item._id,
                        [availabilityMap[item._id]?.status || 'free']: true
                      }"
                      type="button"
                      @click="selectedInstrumentId = item._id"
                    >
                      <div
                        class="thumb large instrument-bar"
                        :class="availabilityMap[item._id]?.status || 'free'"
                        :style="getInstrumentBarStyle(item._id)"
                      ></div>
                      <div class="instrument-main">
                        <div class="instrument-name">{{ item.name }}</div>
                        <div class="instrument-state">
                          <span class="status-dot" :class="availabilityMap[item._id]?.status || 'free'"></span>
                          {{ availabilityMap[item._id]?.label || '可用' }}
                        </div>
                        <div class="instrument-desc">
                          {{ item.remark || availabilityMap[item._id]?.note || '当前空闲' }}
                        </div>
                      </div>
                      <div class="radio-check" :class="{ active: selectedInstrumentId === item._id }"></div>
                    </button>
                  </div>
                </div>

                <div class="card-surface choose-card compact-card compact-date-card">
                  <div class="section-head">
                    <h3>选择日期</h3>
                    <input v-model="selectedDate" class="date-inline" type="date" />
                  </div>

                  <div class="date-grid">
                    <button
                      v-for="item in quickDateOptions"
                      :key="item.key"
                      class="date-chip"
                      :class="{ active: selectedDate === item.value }"
                      type="button"
                      @click="selectedDate = item.value"
                    >
                      <div class="chip-title">{{ item.title }}</div>
                      <div class="chip-date">{{ item.monthDay }}</div>
                      <div class="chip-week">{{ item.weekday }}</div>
                    </button>
                  </div>

                  <div class="rule-text">{{ pageRuleHint }}</div>
                </div>

                <div class="card-surface choose-card compact-card">
                  <div class="section-head">
                    <h3>选择时间段</h3>
                    <span class="mini-tip">{{ formatDateText(selectedDate) }}</span>
                  </div>

                  <div class="legend-row">
                    <span><i class="legend-dot available"></i>可预约</span>
                    <span><i class="legend-dot partial"></i>我的预约</span>
                    <span><i class="legend-dot booked"></i>已占用</span>
                    <span><i class="legend-dot locked"></i>不可预约</span>
                  </div>

                  <p v-if="loading" class="notice loading">正在加载时段数据...</p>
                  <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
                  <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

                  <div v-if="customSlots.length === 0" class="empty-text">
                    当前没有配置时段，请检查系统配置中的默认时段数据。
                  </div>

                  <div v-else class="slot-list">
                    <button
                      v-for="slot in slots"
                      :key="slot.slotStart"
                      class="slot-row"
                      :class="[
                        slot.status,
                        {
                          selected: isSelected(slot),
                          disabled: slot.status === 'locked' || slot.status === 'expired' || slot.status === 'booked'
                        }
                      ]"
                      type="button"
                      @click="handleSlotClick(slot)"
                    >
                      <div class="slot-main-line">
                        <span class="slot-state-dot"></span>
                        <span class="slot-time">{{ slot.slotStart }}--{{ slot.slotEnd }}</span>
                      </div>
                      <div v-if="getSlotPersonName(slot)" class="slot-person">{{ getSlotPersonName(slot) }}</div>
                    </button>
                  </div>
                </div>

                <div class="confirm-card card-surface compact-card">
                  <div class="confirm-title">确认预约</div>
                  <div class="confirm-grid">
                    <div>用户：{{ bookingSummary.userName }}</div>
                    <div>工号：{{ bookingSummary.employeeNo }}</div>
                    <div>仪器：{{ bookingSummary.instrumentName }}</div>
                    <div>日期：{{ bookingSummary.date }}</div>
                    <div class="full">时段：{{ bookingSummary.slots }}</div>
                  </div>
                  <div class="confirm-actions">
                    <button class="secondary-btn" type="button" @click="clearSelectedSlots">清空选择</button>
                    <button
                      class="secondary-btn warning"
                      type="button"
                      @click="cancelSelectedSlots"
                      :disabled="operating || selectedSlotsForOperation.length === 0"
                    >
                      {{ operating ? '处理中...' : '取消预约' }}
                    </button>
                    <button class="primary-btn" type="button" @click="reserveSelectedSlots" :disabled="operating">
                      {{ operating ? '处理中...' : '确认预约' }}
                    </button>
                  </div>
                </div>
              </div>
            </transition>
          </section>

          <section v-else-if="activeTab === 'submission'" key="submission" class="panel-section">
            <div class="section-card card-surface">
              <div class="section-head">
                <h2>提交记录</h2>
                <span class="mini-tip">仅当前设备本地历史</span>
              </div>

              <div class="info-box">
                <div>设备标识：{{ deviceId }}</div>
                <div>记录数量：{{ submissionHistory.length }}</div>
              </div>

              <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
              <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

              <div class="toolbar">
                <button class="secondary-btn" type="button" @click="loadSubmissionHistory">刷新记录</button>
                <button class="secondary-btn danger" type="button" @click="batchDeleteSubmissionLogs">
                  批量删除
                </button>
              </div>

              <div v-if="submissionHistory.length === 0" class="empty-text">
                当前设备还没有提交记录。
              </div>

              <div v-else class="record-list">
                <div v-for="item in submissionHistory" :key="item.id" class="record-card">
                  <label class="record-check">
                    <input
                      type="checkbox"
                      :checked="selectedSubmissionIds.includes(item.id)"
                      @change="toggleSubmissionSelect(item.id)"
                    />
                    <span></span>
                  </label>

                  <div class="record-main">
                    <div class="record-title">
                      {{ item.actionType === 'reserve' ? '预约' : '取消预约' }}
                      · {{ item.instrumentName }}
                    </div>
                    <div class="record-sub">{{ item.date }} · {{ item.slotStart }} - {{ item.slotEnd }}</div>
                    <div class="record-sub">
                      {{ item.userName }}（工号：{{ item.employeeNo }}）
                      <span v-if="item.remark">· {{ item.remark }}</span>
                    </div>
                  </div>

                  <button class="text-btn danger" type="button" @click="deleteSingleSubmissionLog(item.id)">
                    删除
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section v-else key="admin" class="panel-section">
            <div class="section-card card-surface">
              <div class="section-head">
                <h2>管理员面板</h2>
                <span class="mini-tip">仪器、锁定、记录</span>
              </div>

              <div class="login-box" :class="{ authed: adminAuthed }">
                <div class="field-block">
                  <label>管理员密码</label>
                  <input
                    v-model="adminLoginForm.password"
                    type="password"
                    placeholder="默认密码：admin123"
                    :disabled="adminAuthed"
                    @keydown.enter.prevent="confirmAdmin"
                  />
                </div>
                <div class="toolbar">
                  <button v-if="!adminAuthed" class="primary-btn" type="button" @click="confirmAdmin">进入管理</button>
                  <button v-else class="secondary-btn" type="button" @click="logoutAdmin">退出管理</button>
                </div>
              </div>

              <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
              <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

              <template v-if="adminAuthed">
                <div class="admin-tabs">
                  <button class="admin-tab" :class="{ active: adminTab === 'category' }" type="button" @click="adminTab = 'category'">
                    类别管理
                  </button>
                  <button class="admin-tab" :class="{ active: adminTab === 'instrument' }" type="button" @click="adminTab = 'instrument'">
                    仪器管理
                  </button>
                  <button class="admin-tab" :class="{ active: adminTab === 'user' }" type="button" @click="adminTab = 'user'">
                    用户管理
                  </button>
                  <button class="admin-tab" :class="{ active: adminTab === 'password' }" type="button" @click="adminTab = 'password'">
                    修改密码
                  </button>
                  <button class="admin-tab" :class="{ active: adminTab === 'setting' }" type="button" @click="adminTab = 'setting'">
                    预约设置
                  </button>
                  <button class="admin-tab" :class="{ active: adminTab === 'slots' }" type="button" @click="adminTab = 'slots'">
                    时间段管理
                  </button>
                  <button class="admin-tab" :class="{ active: adminTab === 'lock' }" type="button" @click="adminTab = 'lock'">
                    锁定管理
                  </button>
                  <button class="admin-tab" :class="{ active: adminTab === 'record' }" type="button" @click="adminTab = 'record'">
                    预约记录
                  </button>
                </div>

                <div v-if="adminTab === 'category'" class="admin-panel">
                  <div class="field-block">
                    <label>类别名称</label>
                    <input
                      v-model="adminCategoryForm.name"
                      type="text"
                      placeholder="例如：显微镜"
                      @keydown.enter.prevent="addCategory"
                    />
                  </div>
                  <div class="field-block">
                    <label>图标（选填）</label>
                    <input
                      v-model="adminCategoryForm.icon"
                      type="text"
                      placeholder="例如：🔬"
                      @keydown.enter.prevent="addCategory"
                    />
                  </div>
                  <button class="primary-btn full-btn" type="button" @click="addCategory" :disabled="operating">
                    {{ operating ? '处理中...' : '新增类别' }}
                  </button>

                  <div class="mini-list">
                    <div v-for="item in categories" :key="item._id" class="mini-row">
                      <div>
                        <div class="record-title">{{ item.icon || '📱' }} {{ item.name }}</div>
                      </div>
                      <button class="text-btn danger" type="button" @click="deleteCategory(item)">删除</button>
                    </div>
                  </div>
                </div>

                <div v-if="adminTab === 'instrument'" class="admin-panel">
                  <div class="field-block">
                    <label>选择类别</label>
                    <select v-model="adminSelectedCategoryId">
                      <option value="">请先选择类别</option>
                      <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ cat.name }}</option>
                    </select>
                  </div>
                  <div class="field-block">
                    <label>新增仪器名称</label>
                    <input
                      v-model="adminInstrumentForm.name"
                      type="text"
                      placeholder="例如 KG-7500-4"
                      @keydown.enter.prevent="addInstrument"
                    />
                  </div>
                  <div class="field-block">
                    <label>备注</label>
                    <input
                      v-model="adminInstrumentForm.remark"
                      type="text"
                      placeholder="可选说明"
                      @keydown.enter.prevent="addInstrument"
                    />
                  </div>
                  <button class="primary-btn full-btn" type="button" @click="addInstrument" :disabled="operating || !adminSelectedCategoryId">
                    {{ operating ? '处理中...' : '新增仪器' }}
                  </button>

                  <div class="mini-list">
                    <div v-for="item in filteredInstruments" :key="item._id" class="mini-row">
                      <div>
                        <div class="record-title">{{ item.name }}</div>
                        <div class="record-sub">{{ item.remark || '无备注' }}</div>
                      </div>
                      <button class="text-btn danger" type="button" @click="deleteInstrument(item)">删除</button>
                    </div>
                  </div>
                </div>

                <div v-if="adminTab === 'user'" class="admin-panel">
                  <div class="field-block">
                    <label>姓名</label>
                    <input
                      v-model="adminUserForm.userName"
                      type="text"
                      placeholder="请输入用户姓名"
                      @keydown.enter.prevent="addRegisteredUser"
                    />
                  </div>
                  <div class="field-block">
                    <label>工号</label>
                    <input
                      v-model="adminUserForm.employeeNo"
                      type="text"
                      placeholder="请输入用户工号"
                      @keydown.enter.prevent="addRegisteredUser"
                    />
                  </div>
                  <button class="primary-btn full-btn" type="button" @click="addRegisteredUser" :disabled="operating">
                    {{ operating ? '处理中...' : '新增用户' }}
                  </button>

                  <div class="field-block" style="margin-top: 12px;">
                    <label>批量新增（每行格式：姓名 工号）</label>
                    <textarea
                      v-model="batchUserInput"
                      rows="4"
                      placeholder="例如：&#10;张三 1001&#10;李四 1002"
                    ></textarea>
                  </div>
                  <button class="primary-btn full-btn" type="button" @click="batchAddRegisteredUsers" :disabled="operating">
                    {{ operating ? '处理中...' : '批量新增用户' }}
                  </button>

                  <div class="mini-list" style="margin-top: 12px;">
                    <div v-if="registeredUsers.length === 0" class="empty-text">
                      暂无注册用户。
                    </div>
                    <template v-else>
                      <div class="toolbar" style="margin-bottom: 8px;">
                        <label class="check-all-label">
                          <input
                            type="checkbox"
                            :checked="selectedUserKeys.length === registeredUsers.length && registeredUsers.length > 0"
                            @change="(e) => { selectedUserKeys = e.target.checked ? registeredUsers.map((u) => `${u.userName}-${u.employeeNo}`) : [] }"
                          />
                          全选
                        </label>
                        <button
                          class="text-btn danger"
                          type="button"
                          :disabled="selectedUserKeys.length === 0 || operating"
                          @click="batchDeleteRegisteredUsers"
                        >
                          批量删除 ({{ selectedUserKeys.length }})
                        </button>
                      </div>
                      <div
                        v-for="user in registeredUsers"
                        :key="`${user.userName}-${user.employeeNo}`"
                        class="mini-row"
                      >
                        <label class="user-check">
                          <input
                            type="checkbox"
                            :value="`${user.userName}-${user.employeeNo}`"
                            v-model="selectedUserKeys"
                          />
                        </label>
                        <div>
                          <div class="record-title">{{ user.userName }}</div>
                          <div class="record-sub">工号：{{ user.employeeNo }}</div>
                        </div>
                        <button class="text-btn danger" type="button" @click="deleteRegisteredUser(user)">删除</button>
                      </div>
                    </template>
                  </div>
                </div>

                <div v-if="adminTab === 'password'" class="admin-panel">
                  <div class="field-block">
                    <label>当前密码</label>
                    <input
                      v-model="adminPasswordForm.currentPassword"
                      type="password"
                      placeholder="请输入当前管理员密码"
                      @keydown.enter.prevent="changeAdminPassword"
                    />
                  </div>
                  <div class="field-block">
                    <label>新密码</label>
                    <input
                      v-model="adminPasswordForm.newPassword"
                      type="password"
                      placeholder="请输入新密码"
                      @keydown.enter.prevent="changeAdminPassword"
                    />
                  </div>
                  <div class="field-block">
                    <label>确认新密码</label>
                    <input
                      v-model="adminPasswordForm.confirmPassword"
                      type="password"
                      placeholder="请再次输入新密码"
                      @keydown.enter.prevent="changeAdminPassword"
                    />
                  </div>
                  <button class="primary-btn full-btn" type="button" @click="changeAdminPassword" :disabled="operating">
                    {{ operating ? '处理中...' : '确认修改密码' }}
                  </button>
                </div>

                <div v-if="adminTab === 'setting'" class="admin-panel">
                  <div class="field-block">
                    <label>预约开放天数</label>
                    <input
                      v-model.number="adminBookingForm.advanceDays"
                      type="number"
                      min="1"
                      placeholder="例如：1"
                    />
                  </div>
                  <div class="field-block">
                    <label>预约开放时间</label>
                    <select v-model="adminBookingForm.openTime">
                      <option v-for="time in timeOptions" :key="`open-${time}`" :value="time">{{ time }}</option>
                    </select>
                  </div>
                  <button class="primary-btn full-btn" type="button" @click="saveBookingSettings" :disabled="operating">
                    {{ operating ? '处理中...' : '保存预约设置' }}
                  </button>
                </div>

                <div v-if="adminTab === 'slots'" class="admin-panel">
                  <div class="field-block">
                    <label>选择类别</label>
                    <select v-model="adminSelectedCategoryId">
                      <option value="">请先选择类别</option>
                      <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ cat.name }}</option>
                    </select>
                  </div>
                  <div class="inline-row slot-form-row">
                    <div class="field-block compact-field">
                      <label>开始时间</label>
                      <select v-model="adminSlotForm.slotStart" @keydown.enter.prevent="addCustomSlot">
                        <option v-for="time in timeOptions" :key="`start-${time}`" :value="time">
                          {{ time }}
                        </option>
                      </select>
                    </div>
                    <div class="field-block compact-field">
                      <label>结束时间</label>
                      <select v-model="adminSlotForm.slotEnd" @keydown.enter.prevent="addCustomSlot">
                        <option v-for="time in timeOptions" :key="`end-${time}`" :value="time">
                          {{ time }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <button class="primary-btn full-btn" type="button" @click="addCustomSlot" :disabled="operating">
                    {{ operating ? '处理中...' : '新增时间段' }}
                  </button>

                  <div class="mini-list slot-manage-list">
                    <div v-for="slot in customSlots" :key="`${slot.slotStart}-${slot.slotEnd}`" class="mini-row">
                      <div>
                        <div class="record-title">{{ slot.slotStart }} - {{ slot.slotEnd }}</div>
                        <div class="record-sub">时段序号：{{ slot.slotIndex + 1 }}</div>
                      </div>
                      <button class="text-btn danger" type="button" @click="deleteCustomSlot(slot)">删除</button>
                    </div>
                  </div>
                </div>

                <div v-if="adminTab === 'lock'" class="admin-panel">
                  <div class="field-block">
                    <label>选择类别</label>
                    <select v-model="adminSelectedCategoryId">
                      <option value="">请先选择类别</option>
                      <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ cat.name }}</option>
                    </select>
                  </div>
                  <div class="field-block">
                    <label>选择仪器</label>
                    <select v-model="adminLockForm.instrumentId">
                      <option value="">请选择仪器</option>
                      <option v-for="item in filteredInstruments" :key="item._id" :value="item._id">
                        {{ item.name }}
                      </option>
                    </select>
                  </div>

                  <div class="field-block">
                    <label>选择日期</label>
                    <div class="inline-row">
                      <input v-model="adminLockForm.dateInput" type="date" @keydown.enter.prevent="addAdminLockDate" />
                      <button class="secondary-btn" type="button" @click="addAdminLockDate">加入列表</button>
                    </div>
                  </div>

                  <div class="chip-wrap">
                    <span v-for="date in adminLockForm.dates" :key="date" class="date-tag">
                      {{ date }}
                      <button type="button" @click="removeAdminLockDate(date)">×</button>
                    </span>
                  </div>

                  <label class="check-line">
                    <input v-model="adminLockForm.longTerm" type="checkbox" />
                    <span>长期生效（从当前日期起对后续日期有效）</span>
                  </label>

                  <div class="field-block">
                    <label>选择时段</label>
                    <div class="chip-wrap">
                      <button
                        v-for="slot in customSlots"
                        :key="slot.slotIndex"
                        class="slot-tag"
                        :class="{ active: adminLockForm.slotIndexes.includes(slot.slotIndex) }"
                        type="button"
                        @click="toggleAdminLockSlot(slot.slotIndex)"
                      >
                        {{ slot.slotStart }} - {{ slot.slotEnd }}
                      </button>
                    </div>
                  </div>

                  <div class="field-block">
                    <label>锁定原因</label>
                    <input
                      v-model="adminLockForm.reason"
                      type="text"
                      placeholder="例如：维修 / 校准"
                      @keydown.enter.prevent="applyLockAction('lock')"
                    />
                  </div>

                  <div class="info-box">
                    <div>当前仪器：{{ adminTargetInstrumentName || '未选择' }}</div>
                    <div>具体日期：{{ adminLockDatesText }}</div>
                    <div>作用时段：{{ adminSelectedSlotsText }}</div>
                  </div>

                  <div class="toolbar">
                    <button class="secondary-btn warning" type="button" @click="applyLockAction('lock')" :disabled="operating">
                      {{ operating ? '处理中...' : '锁定' }}
                    </button>
                    <button class="secondary-btn danger" type="button" @click="applyLockAction('unlock')" :disabled="operating">
                      {{ operating ? '处理中...' : '解锁' }}
                    </button>
                  </div>
                </div>

                <div v-if="adminTab === 'record'" class="admin-panel">
                  <div class="info-box">
                    <div>查看日期：{{ selectedDate }}</div>
                    <div>记录数量：{{ bookingRecords.length }}</div>
                  </div>

                  <div v-if="bookingRecords.length === 0" class="empty-text">
                    当前日期没有预约记录。
                  </div>

                  <div v-else class="mini-list">
                    <div v-for="record in bookingRecords" :key="record._id" class="mini-row stretch">
                      <div>
                        <div class="record-title">{{ record.instrumentName }} · {{ record.slotStart }} - {{ record.slotEnd }}</div>
                        <div class="record-sub">
                          {{ record.userName }}（工号：{{ record.employeeNo || '无' }}）
                          <span v-if="record.remark">· {{ record.remark }}</span>
                        </div>
                      </div>
                      <button class="text-btn danger" type="button" @click="deleteBookingByAdmin(record)">删除</button>
                    </div>
                  </div>
                </div>

              </template>
            </div>
          </section>
        </transition>
      </div>

      <nav class="bottom-nav">
        <button class="nav-item" :class="{ active: activeTab === 'booking' }" type="button" @click="switchTab('booking')">
          <span class="nav-icon">▣</span>
          <span>预约仪器</span>
        </button>
        <button class="nav-item" :class="{ active: activeTab === 'submission' }" type="button" @click="switchTab('submission')">
          <span class="nav-icon">☰</span>
          <span>提交记录</span>
        </button>
        <button class="nav-item" :class="{ active: activeTab === 'admin' }" type="button" @click="switchTab('admin')">
          <span class="nav-icon">◉</span>
          <span>管理员面板</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(84, 162, 255, 0.18), transparent 24%),
    radial-gradient(circle at top right, rgba(153, 194, 255, 0.18), transparent 22%),
    linear-gradient(180deg, #f7f9fd 0%, #eef3fb 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

:global(*) {
  box-sizing: border-box;
}

.mobile-shell {
  min-height: 100vh;
  padding: 10px 10px 96px;
  position: relative;
  overflow-x: hidden;
  color: #1f2a44;
}

.mobile-bg {
  position: fixed;
  border-radius: 999px;
  filter: blur(28px);
  pointer-events: none;
  z-index: 0;
}

.bg-1 {
  width: 220px;
  height: 220px;
  top: -40px;
  left: -60px;
  background: rgba(68, 143, 255, 0.18);
}

.bg-2 {
  width: 260px;
  height: 260px;
  right: -80px;
  top: 180px;
  background: rgba(125, 188, 255, 0.18);
}

.app-phone {
  position: relative;
  z-index: 1;
  max-width: 430px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 10px;
}

.title-main {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #1f2a44;
}

.title-sub {
  margin-top: 2px;
  font-size: 13px;
  color: #5f6e86;
  font-weight: 600;
}

.header-icon {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 10px 24px rgba(52, 87, 138, 0.1);
  font-size: 18px;
  cursor: pointer;
  color: #4d5d77;
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-section,
.booking-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-surface,
.record-card,
.mini-row {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.92);
  box-shadow:
    0 14px 32px rgba(50, 92, 145, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.hero-card,
.overview-card,
.summary-card,
.choose-card,
.confirm-card,
.section-card {
  padding: 12px;
  border-radius: 20px;
}

.compact-card {
  padding: 10px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.section-head h2,
.section-head h3 {
  margin: 0;
  font-size: 17px;
  line-height: 1.2;
}

.badge-primary,
.mini-tip,
.overview-time {
  font-size: 12px;
  color: #2f74ff;
  font-weight: 700;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.field-block label {
  font-size: 13px;
  font-weight: 700;
  color: #4d5d77;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #dce4f3;
  border-radius: 14px;
  padding: 11px 12px;
  font-size: 13px;
  color: #22304d;
  background: #fbfcff;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus,
textarea:focus,
select:focus {
  border-color: #76a7ff;
  box-shadow: 0 0 0 4px rgba(74, 132, 255, 0.12);
}

textarea {
  resize: vertical;
}

.field-meta {
  text-align: right;
  font-size: 12px;
  color: #8a97ad;
}

.primary-btn,
.secondary-btn,
.ghost-btn {
  border: none;
  border-radius: 14px;
  padding: 11px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
}

.primary-btn:hover,
.secondary-btn:hover,
.ghost-btn:hover,
.instrument-card:hover,
.slot-row:hover,
.date-chip:hover,
.admin-tab:hover,
.nav-item:hover {
  transform: translateY(-1px);
}

.primary-btn {
  color: white;
  background: linear-gradient(135deg, #1d6fff 0%, #2f86ff 52%, #5ba7ff 100%);
  box-shadow: 0 12px 24px rgba(35, 118, 255, 0.24);
}

.secondary-btn {
  color: #355076;
  background: #edf4ff;
}

.secondary-btn.warning {
  color: #9b5d00;
  background: #fff4dd;
}

.secondary-btn.danger,
.text-btn.danger {
  color: #c23a3a;
}

.ghost-btn {
  padding: 9px 12px;
  background: rgba(47, 116, 255, 0.08);
  color: #2f74ff;
}

.full-btn {
  width: 100%;
}

.notice {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.6;
}

.notice.loading {
  background: #eef4ff;
  color: #466180;
}

.notice.error {
  background: #fff0f0;
  color: #c14c4c;
}

.notice.success {
  background: #eefcf3;
  color: #2b8a5e;
}

.overview-row {
  display: grid;
  grid-template-columns: 44px 1fr 92px 44px;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid #edf1f8;
}

.overview-row:first-of-type {
  border-top: none;
}

.thumb {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(145deg, #e9eef8, #cad9ed);
  box-shadow: inset 0 0 0 1px rgba(84, 104, 140, 0.06);
}

.thumb.large {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.thumb.free {
  background: linear-gradient(145deg, #eef7ef, #c8eacc);
}

.thumb.partial {
  background: linear-gradient(145deg, #fff3df, #f7d4a2);
}

.thumb.busy,
.thumb.locked {
  background: linear-gradient(145deg, #f4f0f0, #dbd3d3);
}

.overview-main,
.instrument-main,
.record-main {
  min-width: 0;
}

.overview-title,
.instrument-name,
.record-title,
.confirm-title,
.summary-title {
  font-weight: 800;
  color: #20304a;
}

.overview-sub,
.instrument-state,
.instrument-desc,
.record-sub,
.summary-remark,
.rule-text {
  font-size: 13px;
  line-height: 1.5;
  color: #66758d;
}

.overview-bars {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: #e7ebf2;
}

.bar.active.free {
  background: #6ac37c;
}

.bar.active.partial {
  background: #f0a323;
}

.bar.active.busy,
.bar.active.locked {
  background: #d05656;
}

.overview-count {
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  color: #47566f;
}

.step-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 14px 10px 16px;
  border-radius: 24px;
}

.step-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #d6dde9;
  color: #4f6078;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.step-line {
  position: absolute;
  top: 13px;
  left: calc(50% + 20px);
  width: calc(100% - 24px);
  height: 2px;
  background: #d9dfeb;
}

.step-item.done .step-circle {
  background: #72c67f;
  color: #fff;
}

.step-item.active .step-circle {
  background: #2673ff;
  color: #fff;
  box-shadow: 0 8px 18px rgba(38, 115, 255, 0.3);
}

.step-item.done .step-line,
.step-item.active .step-line {
  background: linear-gradient(90deg, #72c67f, #3d92ff);
}

.step-label {
  font-size: 12px;
  color: #59697f;
  font-weight: 700;
}

.summary-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.summary-name {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 800;
}

.instrument-list,
.record-list,
.mini-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.instrument-list.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.instrument-card,
.slot-row,
.date-chip,
.admin-tab,
.nav-item,
.slot-tag {
  border: none;
  cursor: pointer;
}

.instrument-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  padding: 8px 9px;
  border-radius: 16px;
  text-align: left;
  background: #f9fbff;
  box-shadow: inset 0 0 0 1px #edf2fb;
  position: relative;
  min-height: 0;
}

.instrument-card.active {
  background: linear-gradient(135deg, #eef5ff 0%, #f7fbff 100%);
  box-shadow:
    inset 0 0 0 1px rgba(50, 120, 255, 0.22),
    0 12px 26px rgba(67, 112, 181, 0.12);
}

.instrument-card .instrument-name {
  font-size: 13px;
  line-height: 1.25;
  word-break: break-word;
  padding-right: 24px;
}

.instrument-card .instrument-desc,
.instrument-card .instrument-state {
  font-size: 11px;
  line-height: 1.35;
}

.instrument-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.radio-check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #bac7da;
  position: absolute;
  top: 8px;
  right: 10px;
}

.radio-check.active {
  border-color: #2673ff;
}

.radio-check.active::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: #2673ff;
}

.thumb.large {
  width: calc(100% - 36px);
  height: 12px;
  border-radius: 999px;
}

.instrument-bar {
  margin-right: 0;
  box-shadow: inset 0 0 0 1px rgba(136, 154, 188, 0.12);
}

.status-dot,
.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot.free,
.legend-dot.available {
  background: #6ac37c;
}

.status-dot.partial,
.legend-dot.partial {
  background: #f0a323;
}

.status-dot.busy,
.status-dot.booked,
.legend-dot.booked {
  background: #e05c5c;
}

.status-dot.locked,
.legend-dot.locked {
  background: #9ba7b9;
}

.date-inline {
  width: 116px;
  padding: 7px 9px;
  border-radius: 12px;
  font-size: 12px;
}

.compact-date-card {
  padding-top: 10px;
  padding-bottom: 10px;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  gap: 6px;
}

.date-chip {
  background: #fbfcff;
  box-shadow: inset 0 0 0 1px #e4ebf7;
  border-radius: 14px;
  padding: 8px 6px;
  text-align: center;
}

.date-chip.active {
  background: #eff8f0;
  box-shadow: inset 0 0 0 1px rgba(104, 188, 116, 0.45);
}

.chip-title {
  font-size: 12px;
  color: #58677f;
  font-weight: 700;
}

.chip-date {
  margin-top: 3px;
  font-size: 14px;
  font-weight: 800;
}

.chip-week {
  margin-top: 2px;
  font-size: 11px;
  color: #738198;
}

.legend-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 11px;
  color: #5d6d85;
}

.slot-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.slot-row {
  width: 100%;
  padding: 8px 7px;
  border-radius: 14px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px #edf2fb;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  text-align: left;
  min-height: 46px;
}

.slot-main-line {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.slot-row .slot-time {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.15;
  white-space: nowrap;
}

.slot-state-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  background: #c1cad8;
}

.slot-row .slot-person {
  width: 100%;
  padding-left: 14px;
  font-size: 11px;
  color: #5f6f86;
  line-height: 1.2;
  word-break: break-word;
}

.slot-row.available .slot-state-dot,
.slot-row.selected .slot-state-dot {
  background: #67c778;
}

.slot-row.mine .slot-state-dot {
  background: #f0a323;
}

.slot-row.booked .slot-state-dot {
  background: #ec7a7a;
}

.slot-row.locked .slot-state-dot,
.slot-row.expired .slot-state-dot {
  background: #b1b7c6;
}

.slot-row.selected {
  background: linear-gradient(135deg, #eef7ef 0%, #f7fffa 100%);
  box-shadow: inset 0 0 0 1px rgba(96, 186, 113, 0.42);
}

.slot-row.booked,
.slot-row.locked,
.slot-row.expired,
.slot-row.disabled {
  opacity: 0.78;
}

.confirm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  margin-top: 12px;
  font-size: 13px;
  color: #56657d;
}

.confirm-grid .full {
  grid-column: 1 / -1;
}

.confirm-actions,
.toolbar,
.inline-row,
.two-col {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.confirm-actions {
  margin-top: 10px;
}

.section-card {
  min-height: 360px;
}

.info-box {
  padding: 13px 14px;
  border-radius: 18px;
  background: #f4f8ff;
  color: #59697f;
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 14px;
}

.record-card,
.mini-row {
  border-radius: 18px;
  padding: 14px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.record-check {
  position: relative;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.record-check input {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.record-check span {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid #b8c5d8;
}

.record-check input:checked + span {
  background: #2673ff;
  border-color: #2673ff;
}

.text-btn {
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.login-box {
  padding: 14px;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px #edf2fb;
  margin-bottom: 14px;
}

.login-box.authed {
  box-shadow: inset 0 0 0 1px rgba(80, 163, 101, 0.3);
}

.admin-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.admin-tab {
  padding: 12px 10px;
  border-radius: 14px;
  background: #f6f9ff;
  color: #5d6d86;
  font-size: 13px;
  font-weight: 700;
}

.admin-tab.active {
  background: #edf4ff;
  color: #2673ff;
  box-shadow: inset 0 0 0 1px rgba(38, 115, 255, 0.18);
}

.admin-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.two-col > * {
  flex: 1 1 0;
}

.slot-form-row {
  align-items: flex-end;
}

.compact-field {
  flex: 1 1 0;
  margin-bottom: 0;
}

.slot-manage-list {
  margin-top: 2px;
}

.category-selection {
  padding: 12px;
  border-radius: 20px;
}

.category-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}

.category-list {
  display: flex;
  gap: 10px;
  min-width: min-content;
}

.category-card {
  flex: 0 0 auto;
  width: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border-radius: 18px;
  background: #f9fbff;
  box-shadow: inset 0 0 0 1px #edf2fb;
  border: none;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.category-card:hover {
  transform: translateY(-2px);
  box-shadow: inset 0 0 0 1px rgba(50, 120, 255, 0.22), 0 12px 26px rgba(67, 112, 181, 0.12);
}

.category-card .category-icon {
  font-size: 28px;
  line-height: 1;
}

.category-card .category-name {
  font-size: 13px;
  font-weight: 700;
  color: #20304a;
  text-align: center;
}

.category-summary {
  padding: 10px;
  border-radius: 20px;
}

.category-selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 800;
  color: #20304a;
}

.category-selected-info .category-icon {
  font-size: 22px;
  line-height: 1;
}

.mini-row {
  justify-content: space-between;
}

.mini-row.stretch {
  align-items: center;
}

.empty-text {
  padding: 18px 4px;
  font-size: 13px;
  color: #7b889d;
  text-align: center;
}

.chip-wrap {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.date-tag,
.slot-tag {
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  background: #f3f6fb;
  color: #55657c;
}

.date-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.date-tag button {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #66758d;
}

.slot-tag.active {
  background: #ecf4ff;
  color: #2673ff;
}

.check-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #586880;
}

.bottom-nav {
  position: fixed;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  width: min(calc(100% - 24px), 430px);
  padding: 8px 6px 10px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 18px 40px rgba(43, 75, 119, 0.14);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  z-index: 10;
}

.nav-item {
  background: transparent;
  border-radius: 14px;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  color: #69788f;
  font-size: 12px;
  font-weight: 700;
}

.nav-item.active {
  color: #2673ff;
  background: #eff5ff;
}

.nav-icon {
  font-size: 18px;
}

.tab-fade-enter-active,
.tab-fade-leave-active,
.booking-swap-enter-active,
.booking-swap-leave-active {
  transition: all 0.28s ease;
}

.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.booking-swap-enter-from {
  opacity: 0;
  transform: translateX(24px) scale(0.985);
}

.booking-swap-leave-to {
  opacity: 0;
  transform: translateX(-16px) scale(0.985);
}

@media (max-width: 380px) {
  .title-main {
    font-size: 22px;
  }

  .step-bar {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 10px;
  }

  .step-line {
    display: none;
  }

  .instrument-card {
    min-height: 0;
  }

  .confirm-grid,
  .admin-tabs {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 340px) {
  .slot-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .instrument-list.two-column {
    gap: 8px;
  }

  .instrument-card {
    min-height: 0;
    padding: 8px;
  }

  .thumb.large {
    width: calc(100% - 34px);
    height: 10px;
  }
}
</style>
