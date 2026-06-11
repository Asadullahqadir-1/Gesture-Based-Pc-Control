import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginClient from './page';

export default function LoginServerWrapper(props) {
  const token = cookies().get('df_auth')?.value;
  if (token) {
    // Already authenticated — send to root
    redirect('/');
  }

  return <LoginClient {...props} />;
}
