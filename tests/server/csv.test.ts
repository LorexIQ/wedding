import { describe, it, expect } from 'vitest'
import { guestsToCsv } from '../../server/utils/csv'

describe('guestsToCsv', () => {
  it('returns only the header for an empty list', () => {
    const csv = guestsToCsv([])
    expect(csv).toBe('ID,ФИО,Телефон,Комментарий,Напитки,Сопровождающие')
  })

  it('formats a guest row with companions', () => {
    const csv = guestsToCsv([{
      id: 1,
      fio: 'Иванов Иван',
      phone: '+79990000000',
      comment: null,
      drinks: ['red_dry', 'sparkling'],
      companions: [{ fio: 'Петров Пётр', drinks: ['sparkling'] }]
    }])

    const lines = csv.split('\n')
    // Phone is NOT a free-text field subject to the formula-injection
    // defense: a bare "+79990000000" can't form a spreadsheet formula or
    // DDE payload, and prefixing it with a quote would just mangle a
    // number that's meant to be copied/dialed as-is.
    expect(lines[1]).toBe('1,Иванов Иван,+79990000000,,red_dry; sparkling,Петров Пётр (sparkling)')
  })

  it('does not prefix a phone number even though it starts with +', () => {
    const csv = guestsToCsv([{
      id: 5,
      fio: 'Тест',
      phone: '+79990000000',
      comment: null,
      drinks: [],
      companions: []
    }])

    const lines = csv.split('\n')
    expect(lines[1]).toBe('5,Тест,+79990000000,,,')
  })

  it('escapes commas and quotes in comment field', () => {
    const csv = guestsToCsv([{
      id: 2,
      fio: 'Тест',
      phone: null,
      comment: 'Без орехов, пожалуйста "спасибо"',
      drinks: [],
      companions: []
    }])

    const lines = csv.split('\n')
    expect(lines[1]).toBe('2,Тест,,"Без орехов, пожалуйста ""спасибо""",,')
  })

  it('neutralizes a formula-injection comment starting with =', () => {
    const csv = guestsToCsv([{
      id: 3,
      fio: 'Тест',
      phone: null,
      comment: '=cmd|\'/c calc\'!A1',
      drinks: [],
      companions: []
    }])

    const lines = csv.split('\n')
    expect(lines[1]).toBe("3,Тест,,'=cmd|'/c calc'!A1,,")
  })

  it('neutralizes a formula-injection comment starting with +', () => {
    const csv = guestsToCsv([{
      id: 4,
      fio: 'Тест',
      phone: null,
      comment: '+1+1',
      drinks: [],
      companions: []
    }])

    const lines = csv.split('\n')
    expect(lines[1]).toBe("4,Тест,,'+1+1,,")
  })
})
