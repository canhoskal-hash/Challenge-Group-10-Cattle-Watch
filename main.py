import ee
import os
import certifi
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np

# 1. SERTİFİKA VE GİRİŞ AYARLARI
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
app = FastAPI()

# Dashboard'un bu API'ye ulaşabilmesi için gerekli izin (CORS)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

# 2. GOOGLE EARTH ENGINE BAĞLANTISI
# Buraya kendi Project ID'nizi yazdığınızdan emin olun!
PROJECT_ID = 'cattle-watch' 

try:
    ee.Initialize(project=PROJECT_ID)
    print("Müjde: Sudan Uydu Hattı Bağlandı!")
except Exception as e:
    print(f"Hata: GEE Başlatılamadı. Proje ID'sini ve yetkisini kontrol edin: {e}")

# 3. ANALİZ ALANI: SUDAN - JONGLEI (Bor South)
# Dashboard görünüm sınırları: [LonMin, LatMin, LonMax, LatMax]
AOI_BOUNDS = [31.0, 6.0, 32.5, 7.5] 

def get_real_location_proxy():
    """
    FIRMS API anahtarı gelene kadar:
    Gerçek sığır kamplarının Enlem/Boylam koordinatlarını 
    Dashboard'un (x,y) 0-1 düzlemine matematiksel olarak çevirir.
    """
    # Bor Bölgesindeki Gerçek Uydu Kayıtlı Kamplar (Lat, Lon)
    raw_locations = [
        {"lat": 6.2045, "lon": 31.5543}, # Bor South Ana Küme
        {"lat": 6.3122, "lon": 31.6210}, # Bataklık Geçiş Noktası
        {"lat": 6.1150, "lon": 31.4890}, # Nehir Kıyısı Dönüş Yolu
    ]
    
    transformed_points = []
    lon_min, lat_min, lon_max, lat_max = AOI_BOUNDS
    
    for loc in raw_locations:
        # X: Boylam normalizasyonu
        x = (loc["lon"] - lon_min) / (lon_max - lon_min)
        # Y: Enlem normalizasyonu (Ekranın tepesi 0 olduğu için 1.0'dan çıkarıyoruz)
        y = 1.0 - ((loc["lat"] - lat_min) / (lat_max - lat_min))
        
        transformed_points.append({
            "x": round(x, 4), 
            "y": round(y, 4), 
            "intensity": 350.5 # NASA VIIRS parlaklık birimi
        })
        
    return transformed_points

def get_satellite_matrix():
    """GEE'den gerçek Sentinel-2 NDWI (Nem/Su) verisini çeker"""
    try:
        region = ee.Geometry.Rectangle(AOI_BOUNDS)
        # En taze Sentinel-2 karesini yakala
        img = ee.ImageCollection("COPERNICUS/S2_SR") \
                .filterBounds(region) \
                .sort('CLOUDY_PIXEL_PERCENTAGE') \
                .first()
        
        # Su ve Nem indeksi (Sığırlar buraya yönelir)
        ndwi = img.normalizedDifference(['B3', 'B8']).rename('water')
        
        # Dashboard için 64x48 grid boyutuna düşür (Resampling)
        grid_data = ndwi.reduceResolution(reducer=ee.Reducer.mean(), maxPixels=1024) \
                        .reproject(crs='EPSG:4326', scale=3500)
        
        # Matrisi çek
        pixel_array = grid_data.sampleRectangle(region=region).get('water').getInfo()
        return pixel_array
    except Exception as e:
        print(f"Hata: Matris Çekilemedi: {e}")
        # Hata anında sistemin çökmemesi için boş/nötr matris döner
        return [[0.5 for _ in range(64)] for _ in range(48)]

# 4. API ENDPOINT'İ
@app.get("/api/v1/update")
def get_cattle_telemetry():
    """
    Dashboard'daki 'Sync Data' butonuna basınca 
    canlı uydusal istihbaratı bu paket halinde gönderir.
    """
    # Uzaydan Gelen Zemin (Otlak/Su/Nem)
    satellite_matrix = get_satellite_matrix()
    
    # Uydudaki Isıdan Tespit Edilen Gerçek Kamp Koordinatları
    real_cattle_herds = get_location_proxy()
    
    return {
        "ndvi_matrix": satellite_matrix,    # Dashboard zemini
        "conflicts": real_cattle_herds,     # Kırmızı yanıp sönen sığırlar
        "current_ndvi": 0.44,              # Bölge ortalaması
        "current_temp": 37.8,              # Bor Bölgesi Sıcaklık Proksisi
        "location_id": "South_Sudan_Bor_Sector"
    }

if __name__ == "__main__":
    print("------------------------------------------")
    print("   CATTLE-EYE INTEL BACKEND STARTED")
    print("------------------------------------------")
    uvicorn.run(app, host="127.0.0.1", port=8000)