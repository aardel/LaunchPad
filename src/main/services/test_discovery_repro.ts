import { NetworkDiscoveryService } from './discovery';

async function runTest() {
    console.log('Starting Network Discovery Test...');
    const service = new NetworkDiscoveryService();

    const startTime = Date.now();
    const shares = await service.scanForShares(5000); // 5 seconds scan
    const endTime = Date.now();

    console.log(`Scan completed in ${endTime - startTime}ms`);
    console.log(`Found ${shares.length} shares:`);
    shares.forEach(share => {
        console.log(`- ${share.name} (${share.type})`);
        console.log(`  Host: ${share.host}`);
        console.log(`  IP: ${share.address}`);
        console.log(`  Ports: ${share.openPorts?.join(', ')}`);
    });

    if (shares.length === 0) {
        console.log('FAILURE: No shares found, but they should be present if devices exist.');
    }
}

runTest();
