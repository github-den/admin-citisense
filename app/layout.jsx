import '../src/styles/index.css';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import AppProviders from '../src/components/providers/AppProviders.jsx';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';
import ToastContainer from '../src/components/Toast/Toast.jsx';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'CitiSense',
  description: 'Civic voice platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="remove-extension-hydration-noise" strategy="beforeInteractive">
          {`
            (function () {
              function clean(root) {
                if (!root || !root.querySelectorAll) return;

                if (root.hasAttribute && root.hasAttribute('fdprocessedid')) {
                  root.removeAttribute('fdprocessedid');
                }

                root.querySelectorAll('[fdprocessedid]').forEach(function (node) {
                  node.removeAttribute('fdprocessedid');
                });
              }

              clean(document.documentElement);

              var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                  if (mutation.type === 'attributes' && mutation.attributeName === 'fdprocessedid') {
                    mutation.target.removeAttribute('fdprocessedid');
                  }

                  mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) clean(node);
                  });
                });
              });

              observer.observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['fdprocessedid']
              });

              window.addEventListener('load', function () {
                clean(document.documentElement);
                window.setTimeout(function () {
                  clean(document.documentElement);
                  observer.disconnect();
                }, 2000);
              });
            })();
          `}
        </Script>
        <ErrorBoundary>
          <AppProviders>{children}</AppProviders>
          <ToastContainer />
        </ErrorBoundary>
      </body>
    </html>
  );
}
