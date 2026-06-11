import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginClient from './page.client';

export const dynamic = 'force-dynamic';

export default function LoginServerWrapper() {
    const token = cookies().get('df_auth_v2')?.value;
    if (token) redirect('/');
    return <LoginClient />;
}
