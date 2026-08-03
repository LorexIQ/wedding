import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRsvpForm } from '../../app/composables/useRsvpForm'

describe('useRsvpForm', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 1 }))
  })

  it('adds companions up to a maximum of 3', () => {
    const { form, addCompanion } = useRsvpForm()
    addCompanion(); addCompanion(); addCompanion(); addCompanion()
    expect(form.companions).toHaveLength(3)
  })

  it('removes a companion by index', () => {
    const { form, addCompanion, removeCompanion } = useRsvpForm()
    addCompanion(); addCompanion()
    removeCompanion(0)
    expect(form.companions).toHaveLength(1)
  })

  it('buildPayload returns null and sets an error when fio is missing', () => {
    const { buildPayload, errors } = useRsvpForm()
    const payload = buildPayload()
    expect(payload).toBeNull()
    expect(errors.message).toBeTruthy()
  })

  it('submit calls $fetch with a valid payload', async () => {
    const { form, submit } = useRsvpForm()
    form.fio = 'Иванов Иван'
    form.attending = true
    const ok = await submit()
    expect(ok).toBe(true)
    expect($fetch).toHaveBeenCalledWith('/api/rsvp', expect.objectContaining({ method: 'POST' }))
  })

  it('выбор «не пью» снимает ранее выбранный алкоголь', () => {
    const { form, toggleDrink } = useRsvpForm()
    toggleDrink(form, 'red_dry')
    toggleDrink(form, 'vodka')
    toggleDrink(form, 'none')
    expect(form.drinks).toEqual(['none'])
  })

  it('выбор алкоголя снимает ранее выбранное «не пью»', () => {
    const { form, toggleDrink } = useRsvpForm()
    toggleDrink(form, 'none')
    toggleDrink(form, 'brandy')
    expect(form.drinks).toEqual(['brandy'])
  })

  it('повторный клик снимает выбор', () => {
    const { form, toggleDrink } = useRsvpForm()
    toggleDrink(form, 'red_dry')
    toggleDrink(form, 'red_dry')
    expect(form.drinks).toEqual([])
  })

  it('пустое ФИО даёт ошибку именно у поля fio', () => {
    const { buildPayload, errors } = useRsvpForm()
    buildPayload()
    expect(errors.fields.fio).toBeTruthy()
  })

  it('ошибка поля гаснет после исправления', () => {
    const { form, buildPayload, errors } = useRsvpForm()
    buildPayload()
    form.fio = 'Иванов Иван'
    buildPayload()
    expect(errors.fields.fio).toBeUndefined()
  })

  it('несовместимый набор напитков даёт ошибку у поля drinks', () => {
    const { form, buildPayload, errors } = useRsvpForm()
    form.fio = 'Иванов Иван'
    form.drinks = ['none', 'vodka']
    buildPayload()
    expect(errors.fields.drinks).toBeTruthy()
  })

  it('наборы спутников не влияют друг на друга', () => {
    const { form, addCompanion, toggleDrink } = useRsvpForm()
    addCompanion()
    addCompanion()
    toggleDrink(form.companions[0]!, 'none')
    toggleDrink(form.companions[1]!, 'vodka')
    expect(form.companions[0]!.drinks).toEqual(['none'])
    expect(form.companions[1]!.drinks).toEqual(['vodka'])
  })

  it('предзаполняет форму данными гостя, включая спутников, если они переданы', () => {
    const { form } = useRsvpForm({
      fio: 'Иванов Иван', phone: '+79990000000', comment: 'Без орехов', drinks: ['red_dry'],
      attending: true,
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }]
    })
    expect(form.fio).toBe('Иванов Иван')
    expect(form.attending).toBe(true)
    expect(form.companions).toEqual([{ fio: 'Петров Пётр', drinks: ['sparkling'] }])
  })

  it('без переданных спутников форма пустая по спутникам, как раньше', () => {
    const { form } = useRsvpForm({ fio: 'Иванов Иван' })
    expect(form.companions).toEqual([])
  })

  it('без префилла attending пустой (null)', () => {
    const { form } = useRsvpForm()
    expect(form.attending).toBeNull()
  })

  it('buildPayload требует выбранного attending', () => {
    const { form, buildPayload, errors } = useRsvpForm()
    form.fio = 'Иванов Иван'
    const payload = buildPayload()
    expect(payload).toBeNull()
    expect(errors.fields.attending).toBeTruthy()
  })

  it('buildPayload проходит, когда attending выбран', () => {
    const { form, buildPayload } = useRsvpForm()
    form.fio = 'Иванов Иван'
    form.attending = false
    const payload = buildPayload()
    expect(payload?.attending).toBe(false)
  })

  it('без префилла форма пустая, как раньше', () => {
    const { form } = useRsvpForm()
    expect(form.fio).toBe('')
    expect(form.drinks).toEqual([])
  })

  it('initiallySubmitted=true сразу показывает состояние «отправлено»', () => {
    const { submitted } = useRsvpForm(undefined, true)
    expect(submitted.success).toBe(true)
  })
})
