import React, { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

function Stats() {
  const { connected, account } = useWallet();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthorization = () => {
      const whitelistedAddress = '0x41da761b21d995d2b11616638e48f22342e2a48c5f739517a6e447a13ad5814e';
      if (connected && account?.address) {
        const userAddress = account.address.toLowerCase();
        setAuthorized(userAddress === whitelistedAddress.toLowerCase());
      } else {
        setAuthorized(false);
      }
    };

    checkAuthorization();
  }, [connected, account]);

  useEffect(() => {
    if (authorized) {
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
    } else {
      setLoading(false);
    }
  }, [authorized]);

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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : !authorized ? (
            <section className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center py-16">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.333-1.54-.333-2.31 0L3.938 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Access Denied</h2>
                <p className="text-gray-600">You are not authorized to view this page.</p>
              </div>
            </section>
          ) : (
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Visit Records</h2>
              
              {visits.length === 0 ? (
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
          )}
        </main>

        <footer className="bg-white rounded-lg shadow-md p-6 text-center mt-8">
          <p className="text-gray-600">© 2026 Shelby Upload Tool | Access Statistics</p>
        </footer>
      </div>
    </div>
  );
}

export default Stats;