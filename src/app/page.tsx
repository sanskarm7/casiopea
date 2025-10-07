'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Upload, Shirt, Cloud } from 'lucide-react';

export default function HomePage() {
  const [weather, setWeather] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Try to get user's location and fetch weather
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const res = await fetch(
            `/api/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}`
          );
          const data = await res.json();
          setWeather(data);
          
          // Auto-generate outfits for today
          await generateOutfits(position.coords.latitude, position.coords.longitude);
        } catch (error) {
          console.error('Failed to fetch weather:', error);
        }
      });
    }
  }, []);

  const generateOutfits = async (lat?: number, lon?: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/outfits/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString(),
          count: 6,
          ...(lat && lon && { lat, lon }),
        }),
      });

      const data = await res.json();
      setOutfits(data.outfits || []);
    } catch (error) {
      console.error('Failed to generate outfits:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Casiopea
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI-powered wardrobe management with color theory and weather-based outfit suggestions
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link
              href="/wardrobe"
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Shirt className="w-5 h-5" />
              My Wardrobe
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Upload Items
            </Link>
          </div>
        </div>

        {/* Weather Widget */}
        {weather && (
          <div className="max-w-2xl mx-auto mb-12 bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <Cloud className="w-12 h-12 text-blue-500" />
              <div>
                <h2 className="text-2xl font-bold">Today's Weather</h2>
                <p className="text-gray-600">
                  {weather.current.temperature}°C, {weather.current.condition}
                </p>
                <p className="text-sm text-gray-500">
                  Feels like {weather.current.feels_like}°C • {weather.derived.thermal_band.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Outfit Suggestions */}
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-600" />
              Today's Outfit Suggestions
            </h2>
            <button
              onClick={() => generateOutfits()}
              disabled={loading}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Regenerate'}
            </button>
          </div>

          {outfits.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
              <p className="text-gray-500 mb-4">
                {loading ? 'Generating outfits...' : 'No outfits yet. Upload some clothes to get started!'}
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
              >
                <Upload className="w-4 h-4" />
                Upload your first items
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {outfits.map((outfit, idx) => (
                <div
                  key={outfit.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-700">
                        Outfit {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Score:</span>
                        <span className="text-sm font-bold text-purple-600">
                          {Math.round(outfit.score * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Outfit Items */}
                    <div className="space-y-2 mb-3">
                      {outfit.top && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Top:</span>
                          <span className="text-gray-600">{outfit.top.name}</span>
                        </div>
                      )}
                      {outfit.bottom && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Bottom:</span>
                          <span className="text-gray-600">{outfit.bottom.name}</span>
                        </div>
                      )}
                      {outfit.footwear && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Shoes:</span>
                          <span className="text-gray-600">{outfit.footwear.name}</span>
                        </div>
                      )}
                      {outfit.outerwear && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Jacket:</span>
                          <span className="text-gray-600">{outfit.outerwear.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-xs text-gray-500 capitalize">
                        {outfit.color_harmony_type} harmony
                      </span>
                      <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                        Wear Today
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="max-w-6xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Color Theory AI</h3>
            <p className="text-gray-600">
              Uses LAB color space and ΔE2000 for perceptually accurate color matching
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cloud className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Weather Aware</h3>
            <p className="text-gray-600">
              Suggests outfits based on temperature, rain, wind, and UV index
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shirt className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Smart Tracking</h3>
            <p className="text-gray-600">
              Tracks what you've worn recently to avoid outfit repetition
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

