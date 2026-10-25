"""Local WeDo BLE transport. JSON lines over stdio; no browser pairing UI."""
import asyncio
import json
import sys
import time
from bleak import BleakClient, BleakScanner

BASE = '-1212-efde-1523-785feabcd123'
SERVICES = {'00001523' + BASE, '00004f0e' + BASE}
CHARACTERS = {('0000' + value + BASE) for value in ('1524', '1526', '1527', '1528', '1560', '1561', '1563', '1565')}
CHARACTERS.add('00002a26-0000-1000-8000-00805f9b34fb')
found, clients, subscriptions, locks = {}, {}, set(), {}
released_owners = set()
scanner = None
scanning = False
scan_lock = asyncio.Lock()

def emit(value):
    print(json.dumps(value, ensure_ascii=True), flush=True)

def detected(device, advertisement):
    if SERVICES.intersection(s.lower() for s in advertisement.service_uuids):
        found[device.address] = (device, advertisement, time.monotonic())

def devices():
    return [{'id': address, 'name': adv.local_name or device.name or 'WeDo 2.0',
             'rssi': adv.rssi, 'uuids': adv.service_uuids}
            for address, (device, adv, seen) in found.items()
            if time.monotonic() - seen < 15 or address in clients]

def disconnected(address):
    clients.pop(address, None)
    subscriptions.difference_update({item for item in subscriptions if item[0] == address})
    emit({'event': 'disconnected', 'device': address})

async def command(request):
    global scanner, scanning
    op, owner = request['op'], request['owner']
    if owner in released_owners:
        raise ValueError('La pestaña Bluetooth ya se ha cerrado.')
    if op == 'scan':
        async with scan_lock:
            if not scanning:
                scanner = BleakScanner(detection_callback=detected)
                await scanner.start()
                scanning = True
        return devices()
    if op == 'stop-scan':
        async with scan_lock:
            if scanning:
                await scanner.stop()
                scanning = False
        return None
    if op == 'release':
        released_owners.add(owner)
        for address, (client, client_owner) in list(clients.items()):
            if client_owner == owner:
                async with locks.setdefault(address, asyncio.Lock()):
                    await client.disconnect()
        return None
    address = request.get('device')
    async with locks.setdefault(address, asyncio.Lock()):
        if op == 'connect':
            if address not in found:
                raise ValueError('El hub ya no aparece en el escaneo. Enciéndelo y actualiza.')
            existing = clients.get(address)
            if existing and existing[1] != owner:
                raise ValueError('Este hub está conectado desde otra pestaña local.')
            if len(clients) >= 3 and not existing:
                raise ValueError('WeDo admite hasta tres hubs.')
            if existing:
                client = existing[0]
            else:
                client = BleakClient(found[address][0], timeout=20,
                    disconnected_callback=lambda _: disconnected(address),
                    winrt={'use_cached_services': False})
                await client.connect()
                if owner in released_owners:
                    await client.disconnect()
                    raise ValueError('La pestaña se cerró durante la conexión.')
                clients[address] = (client, owner)
            return [{'uuid': service.uuid, 'characteristics': [
                {'uuid': c.uuid, 'properties': c.properties} for c in service.characteristics
                if c.uuid in CHARACTERS]} for service in client.services]
        item = clients.get(address)
        if not item or item[1] != owner:
            raise ValueError('El hub no está conectado a esta pestaña.')
        client = item[0]
        if op == 'disconnect':
            await client.disconnect()
            return None
        uuid = request.get('characteristic', '').lower()
        if uuid not in CHARACTERS:
            raise ValueError('Característica no permitida para WeDo.')
        if op == 'write':
            data = request.get('data', [])
            if uuid not in {'00001563' + BASE, '00001565' + BASE} or not 1 <= len(data) <= 32:
                raise ValueError('Escritura WeDo no válida.')
            await client.write_gatt_char(uuid, bytes(data), response=bool(request.get('response')))
            return None
        if op == 'read':
            return list(await client.read_gatt_char(uuid))
        if op == 'subscribe':
            key = (address, uuid)
            if key not in subscriptions:
                await client.start_notify(uuid, lambda _, data: emit({
                    'event': 'value', 'device': address, 'characteristic': uuid,
                    'data': list(data), 'owner': owner}))
                subscriptions.add(key)
            return None
        raise ValueError('Operación Bluetooth desconocida.')

async def respond(request):
    try:
        result = await command(request)
        emit({'id': request['id'], 'result': result})
    except Exception as error:
        emit({'id': request.get('id'), 'error': str(error) or type(error).__name__})

async def report_devices():
    while True:
        await asyncio.sleep(1)
        if scanning:
            emit({'event': 'devices', 'devices': devices()})

async def main():
    reporter = asyncio.create_task(report_devices())
    pending = set()
    try:
        while True:
            line = await asyncio.to_thread(sys.stdin.readline)
            if not line:
                break
            task = asyncio.create_task(respond(json.loads(line)))
            pending.add(task)
            task.add_done_callback(pending.discard)
    finally:
        reporter.cancel()
        if scanner and scanning:
            await scanner.stop()
        for client, _ in list(clients.values()):
            await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
