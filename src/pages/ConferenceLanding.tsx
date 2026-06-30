import { Link } from 'react-router-dom';

const CONFERENCES = [
  { id: 'B12', name: 'Big 12', color: '#004B87' },
  { id: 'SEC', name: 'SEC', color: '#00205B' },
  { id: 'B10', name: 'Big Ten', color: '#0B1560' },
  { id: 'ACC', name: 'ACC', color: '#013CA6' },
];

export function ConferenceLanding() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          College Football Championship Probabilities
        </h1>
        <p className="text-lg text-gray-600">
          Simulated probabilities for conference championship game appearances
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {CONFERENCES.map((conf) => (
          <Link
            key={conf.id}
            to={`/${conf.id}`}
            className="block p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow text-white text-center"
            style={{ backgroundColor: conf.color }}
          >
            <h2 className="text-2xl font-bold">{conf.name}</h2>
            <p className="mt-2 text-sm opacity-80">View standings & probabilities</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
