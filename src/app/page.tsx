import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6">股票預測系統</h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            AI 驅動的股票市場預測，使用整合式機器學習模型。
            獲取價格預測、趨勢方向及信心指數。
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            進入儀表板
          </Link>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <FeatureCard
            title="整合式預測"
            description="結合 LSTM 深度學習與 XGBoost 模型，提供更穩健的預測結果"
            icon="🤖"
          />
          <FeatureCard
            title="多重數據來源"
            description="整合 Yahoo Finance 和 Alpha Vantage 數據，確保準確性"
            icon="📊"
          />
          <FeatureCard
            title="即時分析"
            description="技術指標、價格預測及信心指數，一目瞭然"
            icon="⚡"
          />
        </div>

        <div className="mt-16 p-6 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
          <h3 className="text-yellow-400 font-semibold mb-2">免責聲明</h3>
          <p className="text-gray-300 text-sm">
            本應用程式僅供教育及研究目的使用。股票預測本質上具有不確定性，
            不應被視為投資建議。過去的表現不代表未來的結果。
            在做出任何投資決策前，請務必自行研究並諮詢專業財務顧問。
          </p>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
