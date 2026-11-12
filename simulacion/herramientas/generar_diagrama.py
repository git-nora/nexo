# Genera diagram.json para Wokwi (evita escribir a mano las 16 conexiones del halo)
import json
partes = [
  {"type": "board-esp32-s3-devkitc-1", "id": "esp", "top": -40, "left": 400, "attrs": {}},
  {"type": "wokwi-ili9341", "id": "pantalla", "top": -58.5, "left": 58.5, "rotate": 270, "attrs": {}},
  {"type": "wokwi-photoresistor-sensor", "id": "ldr", "top": -60, "left": 560, "rotate": 180, "attrs": {"lux": "300"}},
  {"type": "wokwi-pushbutton", "id": "btnHablar", "top": 60, "left": 600,
   "attrs": {"color": "white", "label": "HABLAR (mantener)", "key": "h", "bounce": "0"}},
  {"type": "wokwi-pushbutton", "id": "btnConfirmar", "top": 140, "left": 600,
   "attrs": {"color": "green", "label": "ESCUCHAR / CONFIRMAR", "key": "v", "bounce": "0"}},
  {"type": "wokwi-pushbutton", "id": "btnSOS", "top": 220, "left": 600,
   "attrs": {"color": "red", "label": "SOS (mantener 3 s)", "key": "s", "bounce": "0"}},
  {"type": "wokwi-buzzer", "id": "buzzer", "top": 250, "left": 300, "attrs": {"volume": "0.2"}},
]
# Halo: 16 LEDs alrededor de la pantalla, sentido horario desde arriba a la izquierda
pos = []
for x in [10, 75, 140, 205, 270]: pos.append((x, -32))          # 0-4 arriba
for y in [25, 80, 135]: pos.append((302, y))                    # 5-7 derecha
for x in [270, 205, 140, 75, 10]: pos.append((x, 186))          # 8-12 abajo
for y in [135, 80, 25]: pos.append((-32, y))                    # 13-15 izquierda
for i, (x, y) in enumerate(pos):
    partes.append({"type": "wokwi-neopixel", "id": f"led{i}", "top": y, "left": x, "attrs": {}})

c = []
def w(a, b, color): c.append([a, b, color, []])
# Monitor Serie de Wokwi conectado al puerto serie (UART0) del ESP32
w("esp:TX", "$serialMonitor:RX", "")
w("esp:RX", "$serialMonitor:TX", "")
# Pantalla ILI9341 (SPI)
w("pantalla:VCC", "esp:3V3.1", "orange"); w("pantalla:GND", "esp:GND.1", "black")
w("pantalla:CS", "esp:10", "blue");  w("pantalla:D/C", "esp:9", "blue")
w("pantalla:RST", "esp:14", "blue"); w("pantalla:MOSI", "esp:11", "blue")
w("pantalla:SCK", "esp:12", "blue"); w("pantalla:MISO", "esp:13", "blue")
w("pantalla:LED", "esp:21", "blue")
# Botones: un lado al GPIO, el otro a GND (pull-up interno)
for b, pin in [("btnHablar", "39"), ("btnConfirmar", "40"), ("btnSOS", "41")]:
    w(f"{b}:1.l", f"esp:{pin}", "gold"); w(f"{b}:2.l", "esp:GND.3", "black")
# Sensor de luz
w("ldr:VCC", "esp:3V3.2", "orange"); w("ldr:GND", "esp:GND.2", "black"); w("ldr:AO", "esp:1", "gray")
# Buzzer (solo simulación)
w("buzzer:2", "esp:7", "purple"); w("buzzer:1", "esp:GND.4", "black")
# Halo: datos encadenados DOUT -> DIN, alimentación 5 V compartida
w("led0:DIN", "esp:42", "white"); w("led0:VDD", "esp:5V", "red"); w("led0:VSS", "esp:GND.1", "black")
for i in range(15):
    w(f"led{i}:DOUT", f"led{i+1}:DIN", "white")
    w(f"led{i}:VDD", f"led{i+1}:VDD", "red")
    w(f"led{i}:VSS", f"led{i+1}:VSS", "black")

diagrama = {"version": 1, "author": "Proyecto integrador", "editor": "wokwi",
            "parts": partes, "connections": c, "dependencies": {}}
json.dump(diagrama, open("/home/claude/simulacion/sketch/diagram.json", "w"), indent=2, ensure_ascii=False)
print(len(partes), "partes,", len(c), "conexiones")
