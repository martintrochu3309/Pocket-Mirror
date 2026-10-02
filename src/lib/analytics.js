import { supabase } from './supabase.js'

const sessionId =
  localStorage.getItem('pm-session-id') ||
  crypto.randomUUID()

localStorage.setItem('pm-session-id', sessionId)

export async function track(eventName, metadata = {}) {
  const { error } = await supabase
    .from('analytics_events')
    .insert({
      event_name: eventName,
      page: window.location.pathname,
      session_id: sessionId,
      metadata
    })

  if (error) {
    console.error('Analytics error:', error)
  }
}
