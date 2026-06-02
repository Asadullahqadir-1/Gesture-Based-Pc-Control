import "./globals.css";
import Header from "./Header";
import AuthGuard from "./AuthGuard";

export const metadata = {
  title: "DriveFlow",
  description: "Web-based gesture dashboard ready for Vercel deployment",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard />
        <Header />
        {children}
      </body>
    </html>
  );
}
