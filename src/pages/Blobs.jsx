import React, { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const getShelbyApiUrl = () => {
  const baseUrl = import.meta.env.VITE_SHELBY_API_URL || "https://api.shelbynet.shelby.xyz";
  return baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl;
};

function Blobs() {
  const { connected, account } = useWallet();
  const [blobs, setBlobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const parseAddress = (address) => {
    if (!address) return null;
    if (typeof address === 'string') return address;
    if (address.data && Array.isArray(address.data)) {
      const hex = address.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
      return `0x${hex}`;
    }
    if (typeof address.toString === 'function') {
      return address.toString();
    }
    return JSON.stringify(address);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatExpiration = (expirationMicros) => {
    const now = Date.now() * 1000;
    const hours = Math.floor((expirationMicros - now) / (1000 * 60 * 60));
    if (hours <= 0) return 'Expired';
    return `${hours} hours`;
  };

  useEffect(() => {
    const fetchBlobs = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!connected || !account || !account.address) {
          setError('Please connect your wallet to view uploaded files');
          setLoading(false);
          return;
        }

        const { Network } = await import('@aptos-labs/ts-sdk');
        const { ShelbyClient } = await import('@shelby-protocol/sdk/browser');
        
        const SHELBY_API_KEY = import.meta.env.VITE_SHELBY_BEARER_TOKEN || '';
        
        if (!SHELBY_API_KEY) {
          throw new Error('SHELBY_BEARER_TOKEN is not set in .env file');
        }
        
        const client = new ShelbyClient({
          network: Network.SHELBYNET,
          apiKey: SHELBY_API_KEY
        });
        
        const currentAccountAddress = parseAddress(account.address);
        
        if (!currentAccountAddress) {
          throw new Error('Failed to parse account address');
        }
        
        const blobs = await client.coordination.getAccountBlobs({
          account: currentAccountAddress
        });
        
        const processedBlobs = blobs.map((blob) => {
          return {
            name: blob.name.split('/').pop() || blob.name,
            blobName: blob.name,
            size: blob.size,
            expirationMicros: blob.expirationMicros,
            status: blob.status,
            owner: blob.owner,
            accountAddress: blob.name.includes('/') ? blob.name.split('/')[0].replace('@', '0x') : currentAccountAddress,
            blobMerkleRoot: blob.blobMerkleRoot,
            encoding: blob.encoding,
            chunkSizeBytes: blob.chunkSizeBytes || (blob.encoding ? blob.encoding.chunkSizeBytes : undefined),
            creationMicros: blob.creationMicros
          };
        });
        
        const sortedBlobs = processedBlobs.sort((a, b) => {
          if (!a.creationMicros) return 1;
          if (!b.creationMicros) return -1;
          return b.creationMicros - a.creationMicros;
        });
        
        setBlobs(sortedBlobs);
        setLoading(false);
      } catch (error) {
        let errorMessage = 'Failed to fetch uploaded files';
        
        if (error instanceof Error) {
          if (error.message.includes('SHELBY_API_KEY is not set')) {
            errorMessage = 'SHELBY_API_KEY is not set in .env file';
          } else if (error.message.includes('Failed to parse account address')) {
            errorMessage = 'Failed to parse account address';
          } else if (error.message.includes('Cannot find module')) {
            errorMessage = 'Missing dependency: @shelby-protocol/sdk';
          } else {
            errorMessage = 'Failed to fetch files: ' + error.message;
          }
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };

    fetchBlobs();
  }, [connected, account]);

  const handleDownload = (blobName) => {
  };

  const handleDelete = (blobName) => {
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="bg-white rounded-lg shadow-md p-6 text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-3">Shelby Upload Tool</h1>
        </header>

        <main>
          <section className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-3 border-b-2 border-gray-100">Uploaded Files ({blobs.length})</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg mb-8">
                <p className="text-gray-600 text-lg">{error}</p>
              </div>
            ) : blobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg mb-8">
                <p className="text-gray-600 text-lg">No files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {blobs.map((blob, index) => {
                  const fileName = blob.name.split('/').pop() || blob.name;
                  const correctAccountAddress = blob.accountAddress;
                  const blobFileName = blob.name.split('/').pop() || blob.name;
                  const correctBlobName = blob.name.includes('/') ? blob.name.replace('@', '0x') : `${correctAccountAddress}/${blobFileName}`;
                  
                  const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

                  const processMerkleRoot = (merkleRoot) => {
                    if (!merkleRoot) return 'N/A';
                    
                    if (typeof merkleRoot === 'string') {
                      return merkleRoot;
                    }
                    
                    if (typeof merkleRoot === 'object') {
                      if (merkleRoot.data && typeof merkleRoot.data === 'object') {
                        const data = merkleRoot.data;
                        const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
                        return '0x' + keys.map(key => {
                          const value = data[key];
                          return (typeof value === 'number' ? value : parseInt(value)).toString(16).padStart(2, '0');
                        }).join('');
                      } else {
                        const keys = Object.keys(merkleRoot).map(Number).sort((a, b) => a - b);
                        return '0x' + keys.map(key => {
                          const value = merkleRoot[key];
                          return (typeof value === 'number' ? value : parseInt(value)).toString(16).padStart(2, '0');
                        }).join('');
                      }
                    }
                    
                    return JSON.stringify(merkleRoot);
                  };
                  
                  const processedMerkleRoot = processMerkleRoot(blob.blobMerkleRoot);
                  
                  const isZeroMerkleRoot = processedMerkleRoot === '0x0000000000000000000000000000000000000000000000000000000000000000';
                  
                  let status = blob.status;
                  if (!status) {
                    if (isZeroMerkleRoot) {
                      status = 'Pending';
                    } else if (new Date(blob.expirationMicros / 1000) < new Date()) {
                      status = 'Expired';
                    } else {
                      status = 'Active';
                    }
                  }
                  
                  const isExpired = new Date(blob.expirationMicros / 1000) < new Date();
                  
                  return (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3 transition-transform duration-200 hover:shadow-md hover:-translate-y-1">
                      <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                        <h3 className="text-lg font-medium text-gray-800 break-all flex-1 min-w-0">
                          {fileName}
                        </h3>
                        <a 
                          href={`${getShelbyApiUrl()}/shelby/v1/blobs/${correctBlobName}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-primary hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-md transition-colors duration-200 text-xs whitespace-nowrap"
                        >
                          Download
                        </a>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
                        <span>
                          <strong className="text-gray-700">Size:</strong>
                          <span className="text-gray-800 ml-1">{fileSizeMB} MB</span>
                        </span>
                        <span>
                          <strong className="text-gray-700">Status:</strong>
                          <span className={`
                          ${status === 'Active' ? 'bg-green-100 text-green-800' : 
                            status === 'Expired' ? 'bg-red-100 text-red-800' : 
                            status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'
                          } px-2 py-0.5 rounded-full text-xs font-medium ml-1
                        `}>
                          {status}
                        </span>
                        </span>
                      </div>
                      
                      <div className="space-y-3 text-xs">
                        <div className="flex items-start flex-wrap">
                          <strong className="text-gray-700">Blob Merkle Root:</strong>
                          <span className="text-gray-800 ml-1 flex-1 min-w-0 whitespace-nowrap overflow-x-auto">
                            {processedMerkleRoot}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-3">
                            <div>
                              <strong className="text-gray-700">Chunk Size:</strong>
                              <span className="text-gray-800 ml-1">
                                {blob.chunkSizeBytes ? 
                                  `${(blob.chunkSizeBytes / (1024 * 1024)).toFixed(0)} MB`
                                : 'N/A'
                                }
                              </span>
                            </div>
                            <div>
                              <strong className="text-gray-700">Blob Size:</strong>
                              <span className="text-gray-800 ml-1">{formatFileSize(blob.size)}</span>
                            </div>
                            <div className="flex items-center flex-wrap">
                              <strong className="text-gray-700">Blob URL:</strong>
                              <span className="text-gray-800 ml-1 flex-1 min-w-0">
                                <a 
                                  href={`${getShelbyApiUrl()}/shelby/v1/blobs/${correctBlobName}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1 whitespace-nowrap"
                                  title="Download from Shelby API"
                                >
                                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                  </svg>
                                  <span className="hidden sm:inline truncate">{getShelbyApiUrl()}...</span>
                                </a>
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <strong className="text-gray-700">Creation:</strong>
                              <span className="text-gray-800 ml-1">{new Date(blob.creationMicros ? blob.creationMicros / 1000 : Date.now()).toLocaleString()}</span>
                            </div>
                            <div>
                              <strong className="text-gray-700">Expiration:</strong>
                              <span className="text-gray-800 ml-1">{new Date(blob.expirationMicros / 1000).toLocaleString()}</span>
                            </div>
                            <div>
                              <strong className="text-gray-700">Encoding:</strong>
                              <span className="text-gray-800 ml-1">
                                {blob.encoding ? 
                                  `${blob.encoding.variant || 'clay'} • n=${blob.encoding.erasure_n || '16'} • k=${blob.encoding.erasure_k || '10'}`
                                : 'N/A'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex justify-center">
              <button 
                className="bg-primary hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-md transition-colors duration-200"
                onClick={() => window.history.back()}
              >
                Back to Home
              </button>
            </div>
          </section>
        </main>

        <footer className="bg-white rounded-lg shadow-md p-6 text-center mt-8">
          <p className="text-gray-600">© 2026 Shelby Upload Tool | Based on Shelby Protocol</p>
        </footer>
      </div>
    </div>
  );
}

export default Blobs;