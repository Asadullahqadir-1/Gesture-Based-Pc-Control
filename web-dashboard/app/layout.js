import "./globals.css";
import Header from "./Header";
import AuthGuard from "./AuthGuard";

export const metadata = {
  title: "AI Gesture Control - Gesture Based PC Control System",
  description: "AI Driven Gesture Based PC Control System - Web-based gesture dashboard ready for Vercel deployment",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try{
              var user = localStorage.getItem('df_user');
              var p = location.pathname || '/';
              if(!user && p !== '/login'){
                location.replace('/login');
              }
              if(user && p === '/login'){
                location.replace('/');
              }
            }catch(e){/* ignore */}
          })();
        `}} />
        <AuthGuard />
        <Header />
        {children}
      </body>
    </html>
  );
}
