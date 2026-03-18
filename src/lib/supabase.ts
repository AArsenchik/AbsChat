import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const getAccessToken = async () => {
  if (typeof localStorage === 'undefined') return null
  const token = localStorage.getItem('supabaseAccessToken')
  if (!token) return null
  const expValue = localStorage.getItem('supabaseAccessTokenExp')
  if (!expValue) return token
  const exp = Number(expValue)
  if (!Number.isFinite(exp)) return token
  if (Date.now() / 1000 > exp - 60) return null
  return token
}

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, { accessToken: getAccessToken })
    : null
