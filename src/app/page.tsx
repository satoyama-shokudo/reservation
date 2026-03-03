import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-warm-50 px-4">
      <div className="text-center">
        <Image
          src="/logo.jpg"
          alt="さとやま食堂"
          width={200}
          height={200}
          className="mx-auto mb-8 rounded-full shadow-lg"
          priority
        />
        <h1
          className="text-3xl font-bold text-warm-800 mb-4"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          さとやま食堂
        </h1>
        <p className="text-warm-600 mb-8">兵庫県丹波市の小さな食堂</p>
        <Link
          href="/reserve"
          className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-8 rounded-lg transition-colors shadow-md"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          ご予約はこちら
        </Link>
      </div>
    </div>
  );
}
