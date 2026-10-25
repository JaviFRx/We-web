"""Scan Windows BLE directly; optionally inspect a selected hub without moving motors."""
import argparse
import asyncio
import json
from bleak import BleakScanner, BleakClient

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--address')
    parser.add_argument('--seconds', type=float, default=20)
    parser.add_argument('--light', action='store_true')
    args = parser.parse_args()
    found = await BleakScanner.discover(timeout=args.seconds, return_adv=True)
    for device, adv in found.values():
        print(json.dumps({'address': device.address, 'name': adv.local_name or device.name,
                          'rssi': adv.rssi, 'services': adv.service_uuids,
                          'manufacturer_ids': list(adv.manufacturer_data)}, ensure_ascii=True), flush=True)
    print(f'Detected {len(found)} BLE devices.', flush=True)
    if args.address:
        match = next((d for d, _ in found.values() if d.address.lower() == args.address.lower()), None)
        if not match:
            raise RuntimeError('Selected hub is not advertising; turn it on and retry.')
        async with BleakClient(match, timeout=20) as client:
            print(f'CONNECTED: {client.is_connected}', flush=True)
            for service in client.services:
                print('SERVICE', service.uuid, flush=True)
                for char in service.characteristics:
                    print(' CHARACTERISTIC', char.uuid, char.properties, flush=True)
            if args.light:
                await client.write_gatt_char('00001563-1212-efde-1523-785feabcd123', bytes([1,2,6,23,1,0,0,0,0,0,0]), response=True)
                await client.write_gatt_char('00001565-1212-efde-1523-785feabcd123', bytes([6,4,3,0,170,204]), response=True)
                print('Blue light command accepted. Holding connection for 5 seconds.', flush=True)
                await asyncio.sleep(5)
        print('Disconnected cleanly.', flush=True)

asyncio.run(main())
