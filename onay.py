import ee
import os
import certifi

# SSL Sertifikasını zorla tanıtıyoruz
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
os.environ['SSL_CERT_FILE'] = certifi.where()

print("Sertifikalar tanımlandı, Google bağlantısı kuruluyor...")
ee.Authenticate()