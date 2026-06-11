import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PageClient from './page.client';

export default function PageServerWrapper() {
    const token = cookies().get('df_auth')?.value;
    if (!token) redirect('/login');
    return <PageClient />;
}
