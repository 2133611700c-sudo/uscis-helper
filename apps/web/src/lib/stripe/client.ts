import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY

export const stripe = secretKey
  ? new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })
  : null

export const STRIPE_PRICES = {
  reparoleU4UTier1: process.env.STRIPE_PRICE_ID_REPAROLE_TIER1 ?? '',
} as const

export const isStripeConfigured = () => !!stripe && !!STRIPE_PRICES.reparoleU4UTier1
