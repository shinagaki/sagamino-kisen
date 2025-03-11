import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain'
import * as turf from '@turf/turf'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

// 相模野基線の2点
const BASELINE_POINTS = {
  shimomizo: {
    name: '下溝村',
    coordinates: [139.406397, 35.531261] as [number, number],
    elevation: 42.1 // メートル
  },
  zama: {
    name: '座間村',
    coordinates: [139.434264, 35.490194] as [number, number],
    elevation: 86.3 // メートル
  }
};

// 最初の拡大三角点
const FIRST_TRIANGULATION_POINTS = {
  tobio: {
    name: '鳶尾山',
    coordinates: [139.324847, 35.504497] as [number, number],
    elevation: 237.2 // メートル
  },
  nagatsuta: {
    name: '長津田村',
    coordinates: [139.483583, 35.512028] as [number, number],
    elevation: 98.5 // メートル
  }
};

// 次の拡大三角点
const SECOND_TRIANGULATION_POINTS = {
  renkoji: {
    name: '連光寺村',
    coordinates: [139.465033, 35.630756] as [number, number],
    elevation: 175.4 // メートル
  },
  asama: {
    name: '浅間山',
    coordinates: [139.312342, 35.322127] as [number, number],
    elevation: 98.7 // メートル
  }
};

// 最終拡大三角点
const FINAL_TRIANGULATION_POINTS = {
  tanzawa: {
    name: '丹沢山',
    coordinates: [139.16268, 35.474293] as [number, number],
    elevation: 1567.1 // メートル
  },
  kano: {
    name: '鹿野山',
    coordinates: [139.955735, 35.254982] as [number, number],
    elevation: 352.8 // メートル
  },
  origin: {
    name: '日本経緯度原点',
    coordinates: [139.741357, 35.658099] as [number, number],
    elevation: 25.7 // メートル
  }
};

const BASELINE_SOURCE_ID = 'baseline-source';
const BASELINE_LAYER_ID = 'baseline-layer';
const TRIANGULATION_SOURCE_ID = 'triangulation-source';
const TRIANGULATION_LAYER_ID = 'triangulation-layer';
const SECOND_TRIANGULATION_SOURCE_ID = 'second-triangulation-source';
const SECOND_TRIANGULATION_LAYER_ID = 'second-triangulation-layer';
const FINAL_TRIANGULATION_SOURCE_ID = 'final-triangulation-source';
const FINAL_TRIANGULATION_LAYER_ID = 'final-triangulation-layer';

// 測量の各段階の説明
const STEP_DESCRIPTIONS = {
  0: '相模野基線は、日本の近代測量の出発点となった重要な基線です。基線の測量は1882年（明治15年）に行われ、その長さは約5.2kmでした。基線の測量には、ベッセル基線尺という特殊な測定器具が使用されました。',
  1: '基線の両端から鳶尾山と長津田村の一等三角点を測量し、最初の三角網を形成します。各点で経緯儀を使用して水平角を測定し、三角形の内角の和が180度になることを確認します。',
  2: '次に連光寺村と浅間山（高麗山）の一等三角点を測量し、三角網をさらに拡大します。基線の長さと測定した角度から、三角点間の距離を計算により求めます。',
  3: '第三増大点として丹沢山と鹿野山を追加し、三角網をさらに拡大します。各三角点での観測を繰り返し、精度を高めていきます。',
  4: '最後に丹沢山、鹿野山と日本経緯度原点を結ぶ三角網を形成し、日本の測地基準点を確立します。この三角網は、日本の近代測量の基礎となりました。'
};

// 測量方法の詳細な説明
const MEASUREMENT_DETAILS = {
  instruments: {
    title: '使用された測量機器',
    content: [
      'ベッセル基線尺: 基線測量に使用された高精度の測定器具',
      'レプソルド経緯儀: 水平角・鉛直角の測定に使用された精密な角度測定器',
      '水準儀: 標高差の測定に使用された機器'
    ]
  },
  methods: {
    title: '測量方法',
    content: [
      '基線測量: 温度補正を行いながら、複数回の往復測定で距離を決定',
      '角度測定: 各三角点で16方位の観測を実施し、平均値を採用',
      '三角計算: 球面三角法を用いて距離と位置を算出'
    ]
  }
};

// 三角点間の距離と角度を計算する関数
const calculateDistanceAndBearing = (point1: [number, number], point2: [number, number]) => {
  const distance = turf.distance(point1, point2, { units: 'kilometers' });
  const bearing = turf.bearing(point1, point2);
  return { distance, bearing };
};

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [measurementData, setMeasurementData] = useState<{
    distance: number;
    bearing: number;
  } | null>(null);
  const [animationStep, setAnimationStep] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(0.5);
  const [selectedPoint, setSelectedPoint] = useState<{
    name: string;
    coordinates: [number, number];
    connections: Array<{
      name: string;
      distance: number;
      bearing: number;
    }>;
  } | null>(null);

  // 基線のアニメーション
  useEffect(() => {
    if (!map.current || !isAnimating) return;

    const animate = () => {
      if (animationProgress < 100) {
        setAnimationProgress(prev => Math.min(prev + animationSpeed, 100));
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        if (animationStep < 4) {
          setAnimationStep(prev => prev + 1);
          // 地図の表示範囲を調整
          if (animationStep === 2) {
            map.current?.fitBounds([
              [139.1, 35.2], // 南西
              [140.0, 35.7]  // 北東
            ]);
          }
        }
      }
    };

    requestAnimationFrame(animate);
  }, [isAnimating, animationProgress, animationSpeed]);

  // 測量データの計算と更新
  useEffect(() => {
    if (!map.current) return;

    const line = turf.lineString([
      BASELINE_POINTS.shimomizo.coordinates,
      BASELINE_POINTS.zama.coordinates
    ]);

    const lineDistance = turf.length(line, { units: 'kilometers' });
    const bearing = turf.bearing(
      turf.point(BASELINE_POINTS.shimomizo.coordinates),
      turf.point(BASELINE_POINTS.zama.coordinates)
    );

    setMeasurementData({
      distance: lineDistance,
      bearing: bearing
    });

    const currentDistance = (lineDistance * animationProgress) / 100;
    const currentPoint = turf.along(line, currentDistance, { units: 'kilometers' });

    const partialLine = turf.lineString([
      BASELINE_POINTS.shimomizo.coordinates,
      currentPoint.geometry.coordinates as [number, number]
    ]);

    const source = map.current.getSource(BASELINE_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(partialLine);
    }

    // 三角測量の線を更新
    if (animationStep >= 1) {
      const triangulationSource = map.current.getSource(TRIANGULATION_SOURCE_ID) as maplibregl.GeoJSONSource;
      if (triangulationSource) {
        const features = [
          turf.lineString([BASELINE_POINTS.shimomizo.coordinates, FIRST_TRIANGULATION_POINTS.tobio.coordinates]),
          turf.lineString([BASELINE_POINTS.shimomizo.coordinates, FIRST_TRIANGULATION_POINTS.nagatsuta.coordinates]),
          turf.lineString([BASELINE_POINTS.zama.coordinates, FIRST_TRIANGULATION_POINTS.tobio.coordinates]),
          turf.lineString([BASELINE_POINTS.zama.coordinates, FIRST_TRIANGULATION_POINTS.nagatsuta.coordinates])
        ];
        triangulationSource.setData(turf.featureCollection(features));
      }
    }

    // 第2段階の三角測量の線を更新
    if (animationStep >= 2) {
      const secondTriangulationSource = map.current.getSource(SECOND_TRIANGULATION_SOURCE_ID) as maplibregl.GeoJSONSource;
      if (secondTriangulationSource) {
        const features = [
          turf.lineString([FIRST_TRIANGULATION_POINTS.tobio.coordinates, SECOND_TRIANGULATION_POINTS.renkoji.coordinates]),
          turf.lineString([FIRST_TRIANGULATION_POINTS.tobio.coordinates, SECOND_TRIANGULATION_POINTS.asama.coordinates]),
          turf.lineString([FIRST_TRIANGULATION_POINTS.nagatsuta.coordinates, SECOND_TRIANGULATION_POINTS.renkoji.coordinates]),
          turf.lineString([FIRST_TRIANGULATION_POINTS.nagatsuta.coordinates, SECOND_TRIANGULATION_POINTS.asama.coordinates])
        ];
        secondTriangulationSource.setData(turf.featureCollection(features));
      }
    }

    // 第3段階の三角測量の線を更新
    if (animationStep >= 3) {
      const finalTriangulationSource = map.current.getSource(FINAL_TRIANGULATION_SOURCE_ID) as maplibregl.GeoJSONSource;
      if (finalTriangulationSource) {
        const features = [
          turf.lineString([SECOND_TRIANGULATION_POINTS.renkoji.coordinates, FINAL_TRIANGULATION_POINTS.tanzawa.coordinates]),
          turf.lineString([SECOND_TRIANGULATION_POINTS.renkoji.coordinates, FINAL_TRIANGULATION_POINTS.kano.coordinates]),
          turf.lineString([SECOND_TRIANGULATION_POINTS.asama.coordinates, FINAL_TRIANGULATION_POINTS.tanzawa.coordinates]),
          turf.lineString([SECOND_TRIANGULATION_POINTS.asama.coordinates, FINAL_TRIANGULATION_POINTS.kano.coordinates])
        ];
        finalTriangulationSource.setData(turf.featureCollection(features));
      }
    }

    // 第4段階の三角測量の線を更新
    if (animationStep >= 4) {
      const finalTriangulationSource = map.current.getSource(FINAL_TRIANGULATION_SOURCE_ID) as maplibregl.GeoJSONSource;
      if (finalTriangulationSource) {
        const existingData = finalTriangulationSource.serialize();
        const existingFeatures = (existingData.data as any).features;
        const newFeatures = [
          ...existingFeatures,
          turf.lineString([FINAL_TRIANGULATION_POINTS.tanzawa.coordinates, FINAL_TRIANGULATION_POINTS.origin.coordinates]),
          turf.lineString([FINAL_TRIANGULATION_POINTS.kano.coordinates, FINAL_TRIANGULATION_POINTS.origin.coordinates])
        ];
        finalTriangulationSource.setData(turf.featureCollection(newFeatures));
      }
    }
  }, [animationProgress, animationStep]);

  // ポップアップコンテンツの生成を更新
  const createPopupContent = (point: { name: string; elevation: number; coordinates: [number, number] }, stage: string) => {
    const connections: Array<{ name: string; coordinates: [number, number] }> = [];

    // 現在のステップに応じて接続点を追加
    if (animationStep >= 1 && Object.values(FIRST_TRIANGULATION_POINTS).some(p => p.name === point.name)) {
      connections.push(...Object.values(BASELINE_POINTS));
    }
    if (animationStep >= 2 && Object.values(SECOND_TRIANGULATION_POINTS).some(p => p.name === point.name)) {
      connections.push(...Object.values(FIRST_TRIANGULATION_POINTS));
    }
    if (animationStep >= 3 && Object.values(FINAL_TRIANGULATION_POINTS).some(p => p.name === point.name)) {
      connections.push(...Object.values(SECOND_TRIANGULATION_POINTS));
    }
    if (animationStep >= 4 && point.name === FINAL_TRIANGULATION_POINTS.origin.name) {
      connections.push(FINAL_TRIANGULATION_POINTS.tanzawa, FINAL_TRIANGULATION_POINTS.kano);
    }

    const connectionDetails = connections.map(conn => {
      const { distance, bearing } = calculateDistanceAndBearing(point.coordinates, conn.coordinates);
      return {
        name: conn.name,
        distance,
        bearing
      };
    });

    return `
      <h3>${point.name}</h3>
      <p>${stage}</p>
      <p>標高: ${point.elevation.toFixed(1)}m</p>
      <div class="connection-details">
        <h4>接続点との関係:</h4>
        ${connectionDetails.map(conn => `
          <p>${conn.name}まで:</p>
          <p>距離: ${conn.distance.toFixed(3)}km</p>
          <p>方位角: ${conn.bearing.toFixed(1)}°</p>
        `).join('')}
      </div>
      <button onclick="window.showMeasurementDetails('${point.name}')">
        測量詳細を表示
      </button>
    `;
  };

  // 測量詳細パネルの表示
  useEffect(() => {
    window.showMeasurementDetails = (pointName: string) => {
      const point = {
        ...BASELINE_POINTS,
        ...FIRST_TRIANGULATION_POINTS,
        ...SECOND_TRIANGULATION_POINTS,
        ...FINAL_TRIANGULATION_POINTS
      }[pointName as keyof typeof BASELINE_POINTS];

      if (point) {
        setSelectedPoint({
          name: point.name,
          coordinates: point.coordinates,
          connections: []
        });
      }
    };
  }, []);

  const getButtonLabel = () => {
    switch (animationStep) {
      case 0:
        return '基線測量開始';
      case 1:
        return '第1段階 三角測量開始';
      case 2:
        return '第2段階 三角測量開始';
      case 3:
        return '第3段階 三角測量開始';
      case 4:
        return '第4段階 三角測量開始';
      default:
        return '測量完了';
    }
  };

  const resetMeasurement = () => {
    setAnimationStep(0);
    setAnimationProgress(0);
    setIsAnimating(false);

    // 地図の表示位置をリセット
    map.current?.setZoom(10);
    map.current?.setCenter([139.42, 35.51]);

    // 基線をリセット
    const source = map.current?.getSource(BASELINE_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(turf.lineString([BASELINE_POINTS.shimomizo.coordinates, BASELINE_POINTS.shimomizo.coordinates]));
    }

    // 第1段階の三角測量線をリセット
    const triangulationSource = map.current?.getSource(TRIANGULATION_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (triangulationSource) {
      triangulationSource.setData(turf.featureCollection([]));
    }

    // 第2段階の三角測量線をリセット
    const secondTriangulationSource = map.current?.getSource(SECOND_TRIANGULATION_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (secondTriangulationSource) {
      secondTriangulationSource.setData(turf.featureCollection([]));
    }

    // 第3段階の三角測量線をリセット
    const finalTriangulationSource = map.current?.getSource(FINAL_TRIANGULATION_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (finalTriangulationSource) {
      finalTriangulationSource.setData(turf.featureCollection([]));
    }
  };

  // 地図の初期化
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json',
      center: [139.42, 35.51] as [number, number],
      zoom: 10,
      pitch: 0 // 2D表示に変更
    });

    map.current.addControl(new maplibregl.NavigationControl());

    // 地図の読み込み完了後にマーカーと基線を追加
    map.current.on('load', () => {
      // 地形データのソースを追加
      const gsiTerrainSource = useGsiTerrainSource(maplibregl.addProtocol);
      map.current!.addSource('terrain', gsiTerrainSource);

      // 地形の陰影を追加
      map.current!.addLayer({
        id: 'hillshading',
        source: 'terrain',
        type: 'hillshade',
        paint: {
          'hillshade-illumination-anchor': 'viewport',
          'hillshade-exaggeration': 0.3,
          'hillshade-shadow-color': '#000000',
          'hillshade-highlight-color': '#FFFFFF',
          'hillshade-accent-color': '#FFFFFF'
        }
      });

      // 地形の3D表示を設定
      map.current!.setTerrain({
        source: 'terrain',
        exaggeration: 1.2
      });

      // カメラの設定を調整
      map.current!.easeTo({
        pitch: 45,
        bearing: 0,
        duration: 0
      });

      map.current!.addSource(BASELINE_SOURCE_ID, {
        type: 'geojson',
        data: turf.lineString([BASELINE_POINTS.shimomizo.coordinates, BASELINE_POINTS.shimomizo.coordinates])
      });

      map.current!.addLayer({
        id: BASELINE_LAYER_ID,
        type: 'line',
        source: BASELINE_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FF0000',
          'line-width': 3
        }
      });

      // 第1段階の三角測量の線のソースとレイヤーを追加
      map.current!.addSource(TRIANGULATION_SOURCE_ID, {
        type: 'geojson',
        data: turf.featureCollection([])
      });

      map.current!.addLayer({
        id: TRIANGULATION_LAYER_ID,
        type: 'line',
        source: TRIANGULATION_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0000FF',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });

      // 第2段階の三角測量の線のソースとレイヤーを追加
      map.current!.addSource(SECOND_TRIANGULATION_SOURCE_ID, {
        type: 'geojson',
        data: turf.featureCollection([])
      });

      map.current!.addLayer({
        id: SECOND_TRIANGULATION_LAYER_ID,
        type: 'line',
        source: SECOND_TRIANGULATION_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#00FF00',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });

      // 第3段階の三角測量の線のソースとレイヤーを追加
      map.current!.addSource(FINAL_TRIANGULATION_SOURCE_ID, {
        type: 'geojson',
        data: turf.featureCollection([])
      });

      map.current!.addLayer({
        id: FINAL_TRIANGULATION_LAYER_ID,
        type: 'line',
        source: FINAL_TRIANGULATION_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FFA500',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });

      // 基線のマーカーを追加
      new maplibregl.Marker({ color: '#FF0000' })
        .setLngLat(BASELINE_POINTS.shimomizo.coordinates)
        .setPopup(new maplibregl.Popup().setHTML(createPopupContent(BASELINE_POINTS.shimomizo, '北端点')))
        .addTo(map.current!);

      new maplibregl.Marker({ color: '#FF0000' })
        .setLngLat(BASELINE_POINTS.zama.coordinates)
        .setPopup(new maplibregl.Popup().setHTML(createPopupContent(BASELINE_POINTS.zama, '南端点')))
        .addTo(map.current!);

      // 第1段階の三角点のマーカーを追加
      Object.values(FIRST_TRIANGULATION_POINTS).forEach(point => {
        new maplibregl.Marker({ color: '#0000FF' })
          .setLngLat(point.coordinates)
          .setPopup(new maplibregl.Popup().setHTML(createPopupContent(point, '第1段階 一等三角点')))
          .addTo(map.current!);
      });

      // 第2段階の三角点のマーカーを追加
      Object.values(SECOND_TRIANGULATION_POINTS).forEach(point => {
        new maplibregl.Marker({ color: '#00FF00' })
          .setLngLat(point.coordinates)
          .setPopup(new maplibregl.Popup().setHTML(createPopupContent(point, '第2段階 一等三角点')))
          .addTo(map.current!);
      });

      // 第3段階の三角点のマーカーを追加
      Object.values(FINAL_TRIANGULATION_POINTS).forEach(point => {
        new maplibregl.Marker({ color: '#FFA500' })
          .setLngLat(point.coordinates)
          .setPopup(new maplibregl.Popup().setHTML(createPopupContent(point, '第3段階 一等三角点')))
          .addTo(map.current!);
      });
    });

    // 3D表示切り替えボタンのイベントハンドラ
    const toggle3D = () => {
      if (!map.current) return;

      const currentPitch = map.current.getPitch();
      if (currentPitch === 0) {
        map.current.easeTo({
          pitch: 45,
          bearing: 0,
          duration: 1000
        });
      } else {
        map.current.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 1000
        });
      }
    };

    // グローバルに関数を公開
    window.toggle3D = toggle3D;
  }, []);

  return (
    <div className="app-container">
      <div className="map-container" ref={mapContainer} />
      <div className="controls">
        <div className="description-panel">
          <p>{STEP_DESCRIPTIONS[animationStep as keyof typeof STEP_DESCRIPTIONS]}</p>
        </div>
        <div className="view-controls">
          <button onClick={() => window.toggle3D()}>
            3D表示切替
          </button>
        </div>
        <div className="speed-control">
          <label>アニメーション速度:</label>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
          />
          <span>{animationSpeed.toFixed(1)}x</span>
        </div>
        <button
          onClick={() => {
            setAnimationProgress(0);
            setIsAnimating(true);
          }}
          disabled={isAnimating || animationStep >= 5}
        >
          {getButtonLabel()}
        </button>
        <button
          onClick={resetMeasurement}
          disabled={isAnimating}
        >
          リセット
        </button>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${animationProgress}%` }}
          />
        </div>
        {measurementData && (
          <div className="measurement-data">
            <p>基線長: {measurementData.distance.toFixed(3)} km</p>
            <p>方位角: {measurementData.bearing.toFixed(1)}°</p>
          </div>
        )}
        {selectedPoint && (
          <div className="measurement-details-panel">
            <h3>{selectedPoint.name}の測量詳細</h3>
            <div className="measurement-methods">
              <h4>{MEASUREMENT_DETAILS.instruments.title}</h4>
              <ul>
                {MEASUREMENT_DETAILS.instruments.content.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <h4>{MEASUREMENT_DETAILS.methods.title}</h4>
              <ul>
                {MEASUREMENT_DETAILS.methods.content.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <button onClick={() => setSelectedPoint(null)}>閉じる</button>
          </div>
        )}
      </div>
    </div>
  )
}

// TypeScriptのグローバル型定義を更新
declare global {
  interface Window {
    showMeasurementDetails: (pointName: string) => void;
    toggle3D: () => void;
  }
}

export default App
