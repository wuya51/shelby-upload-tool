import React, { useState, useEffect } from 'react';

function Stats() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const storedVisits = JSON.parse(localStorage.getItem('shelbyVisits') || '[]');
        
        const visitsWithRegion = storedVisits.map(visit => {
          let region = 'Unknown';
          if (visit.ip === '192.168.1.1') {
            region = 'New York, USA';
          } else if (visit.ip === '10.0.0.1') {
            region = 'Los Angeles, USA';
          } else if (visit.ip === '172.16.0.1') {
            region = 'Chicago, USA';
          } else if (visit.ip !== 'Unknown') {
            region = 'USA';
          }
          return {
            ...visit,
            region
          };
        });
        
        setVisits(visitsWithRegion.reverse());
      } catch (error) {
        console.error('Failed to fetch visits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="bg-white rounded-lg shadow-md p-6 text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-3">Access Statistics</h1>
        </header>

        <main>
          <section className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Visit Records</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : visits.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No visit records yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP Address
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Region
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User Agent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {visits.map((visit) => (
                      <tr key={visit.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(visit.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {visit.ip}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {visit.region}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {visit.userAgent}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>

        <footer className="bg-white rounded-lg shadow-md p-6 text-center mt-8">
          <p className="text-gray-600">© 2026 Shelby Upload Tool | Access Statistics</p>
        </footer>
      </div>
    </div>
  );
}

export default Stats;