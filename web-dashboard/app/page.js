import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PageClient from './page.client';

export const dynamic = 'force-dynamic';

export default function PageServerWrapper() {
    const token = cookies().get('df_auth_v3')?.value;
    if (!token) redirect('/login');
    return <PageClient />;
}
