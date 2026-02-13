export interface Point {
  x: number;
  y: number;
}

export interface PhysicsMetrics {
  t: number[];        
  v: number[];        
  l: number[];        
  s: number;          
  entropy: number;    // BU SATIRI EKLE (Kırmızılık anında gidecek)
  naturalness: number; 
  predictiveError: number; 
}

export class PhysicsEngine {
  gridSize: { cols: number; rows: number };
  potentialField: number[][]; // V-Map (Çevre basıncı)
  suitabilityBias: number[][]; // Geçmiş veriden öğrenilen tercihler
  
  // ML ile optimize edilecek katsayılar
  weights = {
    resource: 0.65,    // Su ve otun çekim gücü (MaxEnt etkisi)
    safety: 1.8,      // Çatışmadan kaçınma gücü
    effort: 2200,      // Hareket maliyeti çarpanı (Lagrangian Scale)
    uncertainty: 0.2  // Bilgi boşluğu payı (Active Inference)
  };

  constructor(cols: number, rows: number) {
    this.gridSize = { cols, rows };
    this.potentialField = Array(rows).fill(0).map(() => Array(cols).fill(0.5));
    this.suitabilityBias = Array(rows).fill(0).map(() => Array(cols).fill(0));
  }

  /**
   * ML ile ağırlıkları kalibre eder (Inverse Reinforcement Learning - IRL)
   * GEE'den gelen gerçek sığır yollarıyla (ground-truth) tahminleri kıyaslar.
   */
  optimize(observedPath: Point[], predictedPath: Point[], learningRate: number = 0.05) {
    // 1. Prediction Drift: Gerçek yol tahminden ne kadar uzakta?
    const drift = observedPath.reduce((acc, p, i) => {
      const pred = predictedPath[i] || predictedPath[predictedPath.length - 1];
      return acc + Math.sqrt(Math.pow(p.x - pred.x, 2) + Math.pow(p.y - pred.y, 2));
    }, 0) / observedPath.length;

    // 2. Katsayı Güncelleme (Gradient Descent Basitleştirmesi)
    if (drift > 0.1) {
      // Sürpriz büyükse çatışma korkusu ağırlığını (safety) artır
      this.weights.safety += learningRate * drift;
      this.weights.resource -= learningRate * (drift / 2);
    } else {
      // Hareket beklentiye yakınsa çevresel kaynak (resource) çekimini güçlendir
      this.weights.resource += learningRate * (1 - drift);
    }
    
    // Katsayı sınırlarını koru
    this.weights.safety = Math.max(0.5, Math.min(3.5, this.weights.safety));
    this.weights.resource = Math.max(0.1, Math.min(1.0, this.weights.resource));
  }

  /**
   * Potansiyel Alanı (Havzayı) oluşturur.
   * GEE'den gelen matris verisiyle (MaxEnt çıktısı) uyumludur.
   */
  generateField(envMatrix: number[][] | null, month: number, conflictPoints: Point[]) {
    // Mevsimsel döngüyü Sin/Cos (Dairesel) olarak kodla (Önemli Yenilik!)
    const seasonSin = Math.sin(2 * Math.PI * month / 12);
    const seasonImpact = Math.abs(seasonSin); // Kurak/Yağış yoğunluğu

    for (let r = 0; r < this.gridSize.rows; r++) {
      for (let c = 0; c < this.gridSize.cols; c++) {
        const x = c / (this.gridSize.cols - 1);
        const y = r / (this.gridSize.rows - 1);

        // 1. MaxEnt Uygunluk Puanı (HSI)
        // Eğer dışarıdan GEE verisi gelirse onu kullan, yoksa simüle et
        let suitability = envMatrix ? envMatrix[r][c] : 0.5;
        
        // 2. Aktif Engeller ve Çekim Merkezleri (Gauss Dağılımı)
        let repulsion = 0;
        conflictPoints.forEach(cp => {
          const d = Math.sqrt(Math.pow(x - cp.x, 2) + Math.pow(y - cp.y, 2));
          repulsion += this.weights.safety * Math.exp(-d * 25); // Çok keskin bariyer
        });

        const waterRef = { x: 0.8, y: 0.2 };
        const dWater = Math.sqrt(Math.pow(x - waterRef.x, 2) + Math.pow(y - waterRef.y, 2));
        const waterAttraction = 0.8 * Math.exp(-dWater * 6) * seasonImpact;

        // V (Enerji) = 1 - P + Engeller
        // P (Probability) yüksekse Enerji düşük olur (Vadiye akış).
        let p = (suitability * this.weights.resource) + waterAttraction + this.suitabilityBias[r][c];
        let v = 1.0 - p + repulsion;

        this.potentialField[r][c] = Math.max(0.01, Math.min(3.0, v));
      }
    }
    return this.potentialField;
  }

  /**
   * Hareketin Fiziğini Denetler
   * Lagrangian aksiyonun (L = T - V) ne kadar verimli olduğunu hesaplar.
   */
  computePhysics(observedPath: Point[]): PhysicsMetrics {
    const t: number[] = []; const v: number[] = []; const l: number[] = [];
    let totalS = 0;
    let turnComplexity = 0; // Kolmogorov / Chaos göstergesi

    for (let i = 0; i < observedPath.length; i++) {
      const p = observedPath[i];
      const prev = observedPath[i - 1] || p;

      // 1. Kinetic Energy T (Biyolojik Efor)
      const vSq = (Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2)) * this.weights.effort;
      const kinetic = 0.5 * vSq;

      // 2. Potential Energy V (Konum Maliyeti)
      const r = Math.min(this.gridSize.rows - 1, Math.max(0, Math.floor(p.y * this.gridSize.rows)));
      const c = Math.min(this.gridSize.cols - 1, Math.max(0, Math.floor(p.x * this.gridSize.cols)));
      const potential = this.potentialField[r][c];

      // 3. Lagrangian & Action
      const lagrange = kinetic - potential;
      t.push(kinetic); v.push(potential); l.push(lagrange);
      totalS += lagrange;

      // 4. Anomali (Düzensizlik) Analizi
      if (i > 1) {
        const angle = Math.abs(Math.atan2(p.y - prev.y, p.x - prev.x) - Math.atan2(prev.y - observedPath[i-2].y, prev.x - observedPath[i-2].x));
        if (angle > 0.5) turnComplexity += angle; // Keskin dönüşler anomali artırır
      }
    }

    const entropyScore = turnComplexity / observedPath.length;
    const naturalness = Math.max(0, 100 - (entropyScore * 50) - (Math.abs(totalS) / 100));

    return { 
      t, v, l, s: totalS, 
      entropy: entropyScore, 
      naturalness: naturalness,
      predictiveError: entropyScore // Bu bizim Kolmogorov proxymiz
    };
  }

  /**
   * Least Action Path: Fiziğin öngördüğü en ideal rotayı bulur (A*)
   */
  solveLagrangianPath(start: Point, end: Point): Point[] {
    const startNode = { r: Math.floor(start.y * (this.gridSize.rows-1)), c: Math.floor(start.x * (this.gridSize.cols-1)) };
    const endNode = { r: Math.floor(end.y * (this.gridSize.rows-1)), c: Math.floor(end.x * (this.gridSize.cols-1)) };

    const openSet: any[] = [{ ...startNode, g: 0, h: 0, f: 0, parent: null }];
    const closedSet = new Set<string>();

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();

      if (current.r === endNode.r && current.c === endNode.c) {
        const path: Point[] = [];
        let curr = current;
        while (curr) {
          path.push({ x: curr.c / (this.gridSize.cols - 1), y: curr.r / (this.gridSize.rows - 1) });
          curr = curr.parent;
        }
        return path.reverse();
      }

      const key = `${current.r},${current.c}`;
      if (closedSet.has(key)) continue;
      closedSet.add(key);

      const neighbors = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
      for (const [dr, dc] of neighbors) {
        const nr = current.r + dr;
        const nc = current.c + dc;
        if (nr >= 0 && nr < this.gridSize.rows && nc >= 0 && nc < this.gridSize.cols) {
          const stepCost = this.potentialField[nr][nc];
          const g = current.g + stepCost; // Lagrangian Maliyet birikimi
          const h = Math.sqrt(Math.pow(nr - endNode.r, 2) + Math.pow(nc - endNode.c, 2)) * 0.1;
          openSet.push({ r: nr, c: nc, g, h, f: g + h, parent: current });
        }
      }
    }
    return [start, end];
  }
}