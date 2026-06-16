import "./globals.css";

export const metadata = {
  title: "AI Driven Gesture Based PC Control System",
  description: "Web-based gesture dashboard ready for Vercel deployment",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
