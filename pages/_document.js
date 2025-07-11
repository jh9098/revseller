import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        <script src="https://js.tosspayments.com/v1/payment-widget"></script>
        <meta name="viewport" content="width=1024" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
