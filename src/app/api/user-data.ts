import { getSession } from '@auth0/nextjs-auth0';
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.sub)
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
      return res.status(500).json({ error: 'Error fetching user data' });
    }

    const userData = {
      full_name: data?.full_name || session.user.name || '',
      whatsapp_phone: data?.whatsapp_phone || '',
      daily_digest_enabled: !!data?.daily_digest_enabled,
      daily_digest_type: data?.daily_digest_type || 'email',
    };

    return res.status(200).json(userData);
  } else if (req.method === 'POST') {
    const { full_name, whatsapp_phone, daily_digest_enabled, daily_digest_type } = req.body;

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: session.user.sub,
        full_name,
        whatsapp_phone,
        daily_digest_enabled,
        daily_digest_type,
      });

    if (error) {
      console.error('Error updating user settings:', error);
      return res.status(500).json({ error: 'Error updating user settings' });
    }

    return res.status(200).json({ message: 'Settings updated successfully' });
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}