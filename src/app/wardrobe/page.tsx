'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Filter, Shirt, Upload } from 'lucide-react';
import Image from 'next/image';

export default function WardrobePage() {
  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchGarments();
  }, [filter]);

  const fetchGarments = async () => {
    try {
      const url = filter === 'all' 
        ? '/api/garments'
        : `/api/garments?category=${filter}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setGarments(data.garments || []);
    } catch (error) {
      console.error('Failed to fetch garments:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', 'top', 'bottom', 'dress', 'footwear', 'outerwear', 'accessory'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/" className="text-purple-600 hover:text-purple-700 mb-4 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Shirt className="w-10 h-10" />
              My Wardrobe
            </h1>
            <p className="text-gray-600">
              {garments.length} items in your collection
            </p>
          </div>

          <Link
            href="/upload"
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Add Items
          </Link>
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex items-center gap-4 overflow-x-auto pb-2">
          <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-lg capitalize whitespace-nowrap transition-colors ${
                filter === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Garment Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading your wardrobe...</p>
          </div>
        ) : garments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <Shirt className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">No items yet in this category</p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
            >
              <Upload className="w-4 h-4" />
              Upload your first items
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {garments.map((garment) => (
              <div
                key={garment.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={garment.image_url}
                    alt={garment.name || 'Garment'}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Category Badge */}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold capitalize">
                    {garment.category}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="font-semibold truncate mb-2">
                    {garment.name || 'Unnamed Item'}
                  </p>

                  {/* Color Palette */}
                  <div className="flex gap-1 mb-2">
                    {garment.colors.slice(0, 5).map((color: any, idx: number) => (
                      <div
                        key={idx}
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: color.hex }}
                        title={`${Math.round(color.ratio * 100)}%`}
                      />
                    ))}
                  </div>

                  {/* Attributes */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Warmth: {garment.warmth_score}/5</span>
                    {garment.wear_count > 0 && (
                      <span>Worn {garment.wear_count}x</span>
                    )}
                  </div>

                  {garment.auto_detected && (
                    <p className="text-xs text-amber-600 mt-2">
                      Auto-detected • Click to confirm
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

