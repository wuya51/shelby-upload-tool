import React, { useState, useEffect } from 'react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useWalletConnection } from "@solana/react-hooks";
import { useStorageAccount } from "@shelby-protocol/solana-kit/react";
import { useSolanaNetwork } from '../SolanaWalletProvider.jsx';

const getShelbyApiUrl = () => {
  const baseUrl = import.meta.env.VITE_SHELBY_API_URL || "https://api.shelbynet.shelby.xyz";
  return baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl;
};

function Blobs() {
  const { connected: aptosConnected, account: aptosAccount } = useAptosWallet();
  const { wallet, status: solanaStatus } = useWalletConnection();
  const { shelbyClient } = useSolanaNetwork();
  const { storageAccountAddress } = useStorageAccount({
    client: shelbyClient,
    wallet,
  });
  
  const solanaConnected = solanaStatus === "connected";
  const [phantomConnected, setPhantomConnected] = useState(false);
  const [phantomPublicKey, setPhantomPublicKey] = useState(null);
  const [blobs, setBlobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fileType, setFileType] = useState('all');
  const itemsPerPage = 10;

  const fileTypes = [
    { value: 'all', label: 'All Files' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'document', label: 'Documents' },
    { value: 'archive', label: 'Archives' },
    { value: 'other', label: 'Other' }
  ];

  const getFileType = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return 'other';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
      return 'image';
    } else if (['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(extension)) {
      return 'video';
    } else if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'].includes(extension)) {
      return 'audio';
    } else if (['pdf', 'doc', 'docx', 'txt', 'md', 'html', 'css', 'js', 'json', 'xml', 'csv', 'xlsx', 'xls', 'ppt', 'pptx'].includes(extension)) {
      return 'document';
    } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
      return 'archive';
    } else {
      return 'other';
    }
  };

  const filteredBlobs = fileType === 'all' 
    ? blobs 
    : blobs.filter(blob => getFileType(blob.name) === fileType);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBlobs = filteredBlobs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBlobs.length / itemsPerPage);

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
    const checkPhantomWallet = () => {
      if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
        setPhantomConnected(window.solana.isConnected);
        setPhantomPublicKey(window.solana.publicKey);

        window.solana.on('connect', () => {
          setPhantomConnected(true);
          setPhantomPublicKey(window.solana.publicKey);
        });

        window.solana.on('disconnect', () => {
          setPhantomConnected(false);
          setPhantomPublicKey(null);
        });

        window.solana.on('accountChanged', (accounts) => {
          setPhantomPublicKey(accounts[0]);
        });
      }
    };

    checkPhantomWallet();
  }, []);

  useEffect(() => {
    const fetchBlobs = async () => {
      try {
        setLoading(true);
        setError(null);

        let currentAccountAddress = null;
        
        if (aptosConnected && aptosAccount && aptosAccount.address) {
          currentAccountAddress = parseAddress(aptosAccount.address);
        } else if (solanaConnected && storageAccountAddress) {
          currentAccountAddress = storageAccountAddress.toString();
        } else if (phantomConnected && phantomPublicKey) {
          currentAccountAddress = phantomPublicKey.toString();
        }

        if (!currentAccountAddress) {
          setBlobs([]);
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
        
        if (!currentAccountAddress) {
          throw new Error('Failed to parse account address');
        }
        
        const blobs = await client.coordination.getAccountBlobs({
          account: currentAccountAddress
        });
        
        const processedBlobs = blobs.map((blob) => {
          let status = 'Pending';
          
          if (blob.is_written && Number(blob.is_written) === 1) {
            status = 'Ready';
          } else if (blob.isWritten && blob.isWritten === true) {
            status = 'Ready';
          } else if (blob.status === 'Ready') {
            status = 'Ready';
          }
          
          return {
            name: blob.name.split('/').pop() || blob.name,
            blobName: blob.name,
            size: blob.size,
            expirationMicros: blob.expirationMicros,
            status: status,
            owner: blob.owner,
            accountAddress: blob.name.includes('/') ? blob.name.split('/')[0].replace('@', '0x') : currentAccountAddress,
            blobMerkleRoot: blob.blobMerkleRoot,
            encoding: blob.encoding,
            chunkSizeBytes: blob.chunkSizeBytes || (blob.encoding ? blob.encoding.chunkSizeBytes : undefined),
            creationMicros: blob.creationMicros,
            isDeleted: blob.is_deleted,
            isWritten: blob.is_written
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
  }, [aptosConnected, aptosAccount, solanaConnected, storageAccountAddress, phantomConnected, phantomPublicKey]);

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 pb-3 border-b-2 border-gray-100">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 sm:mb-0">Uploaded Files ({filteredBlobs.length})</h2>
              <div className="flex items-center space-x-2">
                <label htmlFor="fileType" className="text-gray-700 font-medium">Filter by type:</label>
                <select
                  id="fileType"
                  value={fileType}
                  onChange={(e) => {
                    setFileType(e.target.value);
                    setCurrentPage(1); // Reset to first page when changing filter
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {fileTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
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
              <>
                <div className="space-y-4 mb-8">
                  {currentBlobs.map((blob) => {
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
                    
                    const status = blob.status;
                    
                    return (
                      <div key={blob.name} className="bg-gray-50 border border-gray-200 rounded-lg p-3 transition-transform duration-200 hover:shadow-md hover:-translate-y-1">
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
                            ${status === 'Ready' ? 'bg-green-100 text-green-800' : 
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
                                  <div className="relative group">
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
                                    
                                    <div className="absolute z-50 left-0 bottom-full mb-2 hidden group-hover:block">
                                      {fileName.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) ? (
                                        <div className="p-2 bg-white rounded-md shadow-lg border border-gray-200">
                                          <img 
                                            src={`${getShelbyApiUrl()}/shelby/v1/blobs/${correctBlobName}`} 
                                            alt={fileName} 
                                            className="max-w-64 max-h-64 object-contain"
                                            onError={(e) => {
                                              try {
                                                const imgElement = e.target;
                                                
                                                if (!document.contains(imgElement)) {
                                                  return;
                                                }
                                                
                                                const parentElement = imgElement.parentElement;
                                                if (parentElement && document.contains(parentElement)) {
                                                  const errorDiv = document.createElement('div');
                                                  errorDiv.className = 'p-4 text-sm text-gray-500';
                                                  errorDiv.innerHTML = `<strong>Image preview failed</strong><br /><small class="text-xs text-gray-400">Check if the file exists and is accessible</small>`;
                                                  
                                                  try {
                                                    parentElement.replaceChild(errorDiv, imgElement);
                                                  } catch (replaceError) {
                                                  }
                                                }
                                              } catch (error) {
                                              }
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <div className="p-3 bg-white rounded-md shadow-lg border border-gray-200">
                                          <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                            </svg>
                                            <span className="text-sm text-gray-700">{fileName}</span>
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {formatFileSize(blob.size)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
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
                
                {totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-2 mt-8 mb-4">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-md ${currentPage === page ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
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