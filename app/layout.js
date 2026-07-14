import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Generador de Fichas Técnicas",
  description: "Genera fichas inmobiliarias en PDF desde ZonaProp, Argenprop y MercadoLibre",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
