import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PageClient from './page';

export default function PageServerWrapper(props) {
  const token = cookies().get('df_auth')?.value;
  if (!token) {
    // No auth token — redirect to login
    redirect('/login');
  }

  return <PageClient {...props} />;
}
