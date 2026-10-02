import { supabase } from './lib/supabase.js'
import { track } from './lib/analytics.js'

export async function saveEmail(email) {
  const { error } = await supabase
    .from('email_leads')
    .insert({
      email,
      source: 'look_more',
      consent_at: new Date().toISOString()
    })

  // A returning visitor already has access.
  if (error && error.code !== '23505') {
    throw error
  }
}

window.track = track
window.saveEmail = saveEmail

track('page_view', { page: 'home' })
