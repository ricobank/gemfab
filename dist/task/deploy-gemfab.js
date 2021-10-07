"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var debug = require('debug')('gemfab:task');
var dpack = require('dpack');
var task = require('hardhat/config').task;
task('deploy-gemfab', 'deploy GemFab')
    .addParam('dpack', 'output path for dpack')
    .setAction(function (args, hre) { return __awaiter(void 0, void 0, void 0, function () {
    var ethers, network, acct, deployer, gf;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ethers = hre.ethers, network = hre.network;
                return [4 /*yield*/, hre.ethers.getSigners()];
            case 1:
                acct = (_a.sent())[0];
                deployer = acct.address;
                console.log("Deploying contracts using " + deployer + " to " + network.name);
                return [4 /*yield*/, dpack.initPackFile(args.dpack)];
            case 2:
                _a.sent();
                return [4 /*yield*/, dpack.mutatePackFile(args.dpack, args.dpack, function (mutator) { return __awaiter(void 0, void 0, void 0, function () {
                        var GemArtifact, GemFabDeployer, GemFabArtifact;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, hre.artifacts.readArtifact('Gem')];
                                case 1:
                                    GemArtifact = _a.sent();
                                    return [4 /*yield*/, mutator.addType(GemArtifact)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, hre.ethers.getContractFactory('GemFab')];
                                case 3:
                                    GemFabDeployer = _a.sent();
                                    return [4 /*yield*/, GemFabDeployer.deploy()];
                                case 4:
                                    gf = _a.sent();
                                    return [4 /*yield*/, gf.deployed()];
                                case 5:
                                    _a.sent();
                                    console.log('GemFab deployed to : ', gf.address);
                                    return [4 /*yield*/, hre.artifacts.readArtifact('GemFab')];
                                case 6:
                                    GemFabArtifact = _a.sent();
                                    return [4 /*yield*/, mutator.addType(GemFabArtifact)];
                                case 7:
                                    _a.sent();
                                    return [4 /*yield*/, mutator.addObject('gemfab', gf.address, network.name, GemFabArtifact)];
                                case 8:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
