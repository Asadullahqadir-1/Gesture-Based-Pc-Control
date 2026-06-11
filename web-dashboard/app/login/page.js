import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginClient from './page.client';

export default function LoginServerWrapper() {
    const token = cookies().get('df_auth')?.value;
    if (token) redirect('/');
    return <LoginClient />;
}
