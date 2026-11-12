import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null si la app se compiló sin las llaves de Supabase (funciona solo local). */
export const supabase: SupabaseClient | null =
  url && llave
    ? createClient(url, llave, {
        auth: {
          persistSession: true, // la sesión sobrevive offline y al cerrar la app
          autoRefreshToken: true,
          detectSessionInUrl: false, // usamos HashRouter: no leer tokens del #
        },
      })
    : null
