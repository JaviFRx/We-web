"""Exercise native-worker ownership and cleanup without a Bluetooth radio."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import time
import types
import unittest
from unittest.mock import patch

class Scanner:
    def __init__(self, **kwargs):
        self.started = False
    async def start(self):
        self.started = True
    async def stop(self):
        self.started = False

class Client:
    gate = None
    def __init__(self, device, disconnected_callback, **kwargs):
        self.device, self.callback = device, disconnected_callback
        self.services, self.writes, self.callbacks = [], [], {}
        self.connected = False
    async def connect(self):
        if self.gate:
            await self.gate.wait()
        self.connected = True
    async def disconnect(self):
        self.connected = False
        self.callback(self)
    async def write_gatt_char(self, uuid, data, response):
        self.writes.append((uuid, list(data), response))
    async def start_notify(self, uuid, callback):
        self.callbacks[uuid] = callback

class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        Client.gate = None
        spec = importlib.util.spec_from_file_location('worker_test', Path(__file__).parents[1] / 'scripts/local-ble-worker.py')
        self.worker = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'bleak': types.SimpleNamespace(BleakClient=Client, BleakScanner=Scanner)}):
            spec.loader.exec_module(self.worker)
        self.events = []
        self.worker.emit = self.events.append
        device = types.SimpleNamespace(address='A', name='grupo 12')
        advert = types.SimpleNamespace(service_uuids=['00001523' + self.worker.BASE], local_name='grupo 12', rssi=-45)
        self.worker.detected(device, advert)
    async def call(self, op, owner='tab', **kwargs):
        return await self.worker.command({'op': op, 'owner': owner, 'device': 'A', **kwargs})
    async def test_discovery_expires_and_scanner_stops(self):
        self.assertEqual(len(await self.call('scan')), 1)
        d, a, _ = self.worker.found['A']
        self.worker.found['A'] = (d, a, time.monotonic() - 20)
        self.assertEqual(self.worker.devices(), [])
        await self.call('stop-scan')
        self.assertFalse(self.worker.scanning)
    async def test_commands_and_notifications_are_owned(self):
        await self.call('connect')
        with self.assertRaisesRegex(ValueError, 'otra pestaña'):
            await self.call('connect', owner='other')
        with self.assertRaisesRegex(ValueError, 'esta pestaña'):
            await self.call('write', owner='other', characteristic='00001565' + self.worker.BASE, data=[6,4,1,6])
        await self.call('write', characteristic='00001565' + self.worker.BASE, data=[6,4,1,6])
        client = self.worker.clients['A'][0]
        self.assertEqual(client.writes[0][1], [6,4,1,6])
        button = '00001526' + self.worker.BASE
        await self.call('subscribe', characteristic=button)
        client.callbacks[button](None, bytes([1]))
        self.assertEqual(self.events[-1]['owner'], 'tab')
        self.assertEqual(self.events[-1]['data'], [1])
        with self.assertRaisesRegex(ValueError, 'no permitida'):
            await self.call('write', characteristic='arbitrary', data=[1])
        await self.call('release')
        self.assertFalse(client.connected)
        self.assertFalse(self.worker.clients)
    async def test_close_while_connecting_does_not_leave_orphan_hub(self):
        Client.gate = asyncio.Event()
        pending = asyncio.create_task(self.call('connect'))
        await asyncio.sleep(0)
        await self.call('release')
        Client.gate.set()
        with self.assertRaisesRegex(ValueError, 'cerró durante'):
            await pending
        self.assertFalse(self.worker.clients)

if __name__ == '__main__':
    unittest.main()
