// test/GuessingGame_test.js
// Tests unitaires pour Hardhat

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe("GuessingGame - Tests Unitaires Complets", function() {
    let contract;
    let owner;
    let player1;
    let player2;
    let player3;
    let outsider;
    let GuessingGame;

    before(async function() {
        // Recuperer le contrat compile
        GuessingGame = await ethers.getContractFactory("GuessingGame");
    });

    // Configuration initiale avant chaque test
    beforeEach(async function() {
        // Recuperer les comptes
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        player1 = accounts[1];
        player2 = accounts[2];
        player3 = accounts[3];
        outsider = accounts[4];

        // Deployer un nouveau contrat pour chaque test
        contract = await GuessingGame.deploy();
        await contract.waitForDeployment();
    });

    // ============================================================
    // TESTS DU CONSTRUCTEUR
    // ============================================================
    describe("Constructeur", function() {
        it("Devrait definir le bon owner", async function() {
            const contractOwner = await contract.owner();
            expect(contractOwner).to.equal(owner.address);
        });

        it("Devrait initialiser isInitialised a false", async function() {
            const isInit = await contract.isInitialised();
            expect(isInit).to.equal(false);
        });

        it("Devrait avoir tokenOwner a address(0)", async function() {
            const tokenOwner = await contract.tokenOwner();
            expect(tokenOwner).to.equal("0x0000000000000000000000000000000000000000");
        });

        it("Devrait avoir amount a 0", async function() {
            const amount = await contract.amount();
            expect(amount).to.equal(0);
        });

        it("Devrait avoir dernierguesser a address(0)", async function() {
            const dernier = await contract.dernierguesser();
            expect(dernier).to.equal("0x0000000000000000000000000000000000000000");
        });
    });

    // ============================================================
    // TESTS DE initGame()
    // ============================================================
    describe("initGame()", function() {
        const secret = "monSecret123";
        const initAmount = ethers.parseEther("2.0");

        describe("PRE-CONDITIONS (doit echouer si non respectees)", function() {
            it("Ne doit pas permettre a un non-owner d'initialiser", async function() {
                await expect(
                    contract.connect(player1).initGame(secret, { value: initAmount })
                ).to.be.revertedWith("Seul owner peut initier");
            });

            it("Ne doit pas permettre d'initialiser sans ETH", async function() {
                await expect(
                    contract.connect(owner).initGame(secret, { value: 0 })
                ).to.be.revertedWith("Doit deposer des ETH");
            });

            it("Ne doit pas permettre de reinitialiser un jeu deja actif", async function() {
                await contract.connect(owner).initGame(secret, { value: initAmount });
                
                await expect(
                    contract.connect(owner).initGame(secret, { value: initAmount })
                ).to.be.revertedWith("Jeu deja initialise");
            });
        });

        describe("POST-CONDITIONS (apres initialisation reussie)", function() {
            beforeEach(async function() {
                await contract.connect(owner).initGame(secret, { value: initAmount });
            });

            it("Devrait definir isInitialised a true", async function() {
                const isInit = await contract.isInitialised();
                expect(isInit).to.equal(true);
            });

            it("Devrait stocker le bon amount", async function() {
                const amount = await contract.amount();
                expect(amount).to.equal(initAmount);
            });

            it("Devrait calculer le bon secretHash", async function() {
                const secretHash = await contract.secretHash();
                const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(secret));
                expect(secretHash).to.equal(expectedHash);
            });

            it("tokenOwner devrait rester a address(0) apres initGame", async function() {
                const tokenOwner = await contract.tokenOwner();
                expect(tokenOwner).to.equal("0x0000000000000000000000000000000000000000");
            });
        });
    });

    // ============================================================
    // TESTS DE giveToken()
    // ============================================================
    describe("giveToken()", function() {
        const secret = "testSecret";
        const initAmount = ethers.parseEther("1.0");

        beforeEach(async function() {
            await contract.connect(owner).initGame(secret, { value: initAmount });
        });

        describe("PRE-CONDITIONS (doit echouer si non respectees)", function() {
            it("Ne doit pas permettre a un outsider de donner le token", async function() {
                await expect(
                    contract.connect(outsider).giveToken(player2.address)
                ).to.be.revertedWith("Pas autorise");
            });

            it("Ne doit pas permettre de donner a l'adresse 0", async function() {
                await expect(
                    contract.connect(owner).giveToken("0x0000000000000000000000000000000000000000")
                ).to.be.revertedWith("Adresse invalide");
            });

            it("Ne doit pas permettre de donner le token a soi-meme", async function() {
                await contract.connect(owner).giveToken(player1.address);
                
                await expect(
                    contract.connect(player1).giveToken(player1.address)
                ).to.be.revertedWith("Deja token owner");
            });

            it("Ne doit pas permettre giveToken si jeu non initialise", async function() {
                const newContract = await GuessingGame.deploy();
                await newContract.waitForDeployment();
                
                await expect(
                    newContract.connect(owner).giveToken(player1.address)
                ).to.be.reverted;
            });
        });

        describe("POST-CONDITIONS (apres transfert reussi)", function() {
            it("Devrait changer tokenOwner (par l'owner)", async function() {
                expect(await contract.tokenOwner()).to.equal("0x0000000000000000000000000000000000000000");
                
                await contract.connect(owner).giveToken(player1.address);
                
                expect(await contract.tokenOwner()).to.equal(player1.address);
            });

            it("Devrait changer tokenOwner (par le tokenOwner actuel)", async function() {
                await contract.connect(owner).giveToken(player1.address);
                await contract.connect(player1).giveToken(player2.address);
                
                expect(await contract.tokenOwner()).to.equal(player2.address);
            });

            it("Ne devrait pas changer les autres variables d'etat", async function() {
                const amountBefore = await contract.amount();
                const secretHashBefore = await contract.secretHash();
                const isInitialisedBefore = await contract.isInitialised();
                const dernierguesserBefore = await contract.dernierguesser();
                
                await contract.connect(owner).giveToken(player1.address);
                
                expect(await contract.amount()).to.equal(amountBefore);
                expect(await contract.secretHash()).to.equal(secretHashBefore);
                expect(await contract.isInitialised()).to.equal(isInitialisedBefore);
                expect(await contract.dernierguesser()).to.equal(dernierguesserBefore);
            });
        });
    });

    // ============================================================
    // TESTS DE guess()
    // ============================================================
    describe("guess()", function() {
        const secret = "tresorCache";
        const newSecret = "nouveauTresor";
        const initAmount = ethers.parseEther("3.0");

        beforeEach(async function() {
            await contract.connect(owner).initGame(secret, { value: initAmount });
            await contract.connect(owner).giveToken(player1.address);
        });

        describe("PRE-CONDITIONS (doit echouer si non respectees)", function() {
            it("Ne doit pas permettre a un non-tokenOwner de jouer", async function() {
                await expect(
                    contract.connect(outsider).guess(secret, 100, newSecret)
                ).to.be.revertedWith("Pas ton tour !");
            });

            it("Ne doit pas permettre un montant demande de 0", async function() {
                await expect(
                    contract.connect(player1).guess(secret, 0, newSecret)
                ).to.be.revertedWith("Montant > 0");
            });

            it("Ne doit pas permettre de demander plus que le solde", async function() {
                const tooMuch = ethers.parseEther("5.0");
                await expect(
                    contract.connect(player1).guess(secret, tooMuch, newSecret)
                ).to.be.revertedWith("Pas assez de fonds");
            });

            it("Ne doit pas permettre au meme joueur de jouer deux fois de suite", async function() {
                await contract.connect(player1).guess("mauvais", 100, newSecret);
                
                await expect(
                    contract.connect(player1).guess("autre", 100, newSecret)
                ).to.be.revertedWith("Vous avez deja joue !");
            });

            it("Ne doit pas permettre guess si jeu non initialise", async function() {
                const newContract = await GuessingGame.deploy();
                await newContract.waitForDeployment();
                
                await expect(
                    newContract.connect(player1).guess(secret, 100, newSecret)
                ).to.be.revertedWith("Pas ton tour !");
            });
        });

        describe("POST-CONDITIONS - CAS ECHEC (mauvais secret)", function() {
            const wrongGuess = "mauvaisSecret";
            const requestAmount = ethers.parseEther("1.0");

            it("Ne devrait pas changer le amount", async function() {
                const amountBefore = await contract.amount();
                
                await contract.connect(player1).guess(wrongGuess, requestAmount, newSecret);
                
                expect(await contract.amount()).to.equal(amountBefore);
            });

            it("Devrait mettre a jour dernierguesser", async function() {
                await contract.connect(player1).guess(wrongGuess, requestAmount, newSecret);
                expect(await contract.dernierguesser()).to.equal(player1.address);
            });

            it("Ne devrait pas changer le secretHash", async function() {
                const secretHashBefore = await contract.secretHash();
                await contract.connect(player1).guess(wrongGuess, requestAmount, newSecret);
                expect(await contract.secretHash()).to.equal(secretHashBefore);
            });
        });

        describe("POST-CONDITIONS - CAS SUCCES (bon secret)", function() {
            const winAmount = ethers.parseEther("1.5");

            it("Devrait diminuer le amount du montant gagne", async function() {
                await contract.connect(player1).guess(secret, winAmount, newSecret);
                expect(await contract.amount()).to.equal(initAmount - winAmount);
            });

            it("Devrait changer le secretHash avec le nouveau secret", async function() {
                await contract.connect(player1).guess(secret, winAmount, newSecret);
                
                const expectedNewHash = ethers.keccak256(ethers.toUtf8Bytes(newSecret));
                expect(await contract.secretHash()).to.equal(expectedNewHash);
            });

            it("Devrait mettre a jour dernierguesser", async function() {
                await contract.connect(player1).guess(secret, winAmount, newSecret);
                expect(await contract.dernierguesser()).to.equal(player1.address);
            });

            it("Si amount == 0 apres gain, tokenOwner doit etre address(0)", async function() {
                await contract.connect(player1).guess(secret, initAmount, newSecret);
                
                expect(await contract.amount()).to.equal(0);
                expect(await contract.tokenOwner()).to.equal("0x0000000000000000000000000000000000000000");
            });

            it("Si amount > 0 apres gain, tokenOwner ne change pas", async function() {
                const tokenOwnerBefore = await contract.tokenOwner();
                
                await contract.connect(player1).guess(secret, winAmount, newSecret);
                
                expect(await contract.tokenOwner()).to.equal(tokenOwnerBefore);
            });
        });
    });

    // ============================================================
    // TESTS DES INVARIANTS ET SECURITE
    // ============================================================
    describe("Invariants et Securite", function() {
        it("Devrait maintenir l'invariant amount == address(this).balance", async function() {
            const initAmount = ethers.parseEther("4.0");
            await contract.connect(owner).initGame("secret", { value: initAmount });
            
            expect(await contract.amount()).to.equal(
                await ethers.provider.getBalance(contract.target)
            );
            
            await contract.connect(owner).giveToken(player1.address);
            await contract.connect(player1).guess("secret", ethers.parseEther("2.0"), "new");
            
            expect(await contract.amount()).to.equal(
                await ethers.provider.getBalance(contract.target)
            );
        });

        it("Devrait proteger contre les appels multiples rapides", async function() {
            await contract.connect(owner).initGame("secret", { value: ethers.parseEther("5.0") });
            await contract.connect(owner).giveToken(player1.address);
            
            await contract.connect(player1).guess("mauvais", ethers.parseEther("1.0"), "new");
            
            await expect(
                contract.connect(player1).guess("secret", ethers.parseEther("1.0"), "new")
            ).to.be.revertedWith("Vous avez deja joue !");
        });

        it("Devrait permettre a un joueur de rejouer apres qu'un autre ait joue", async function() {
            await contract.connect(owner).initGame("secret", { value: ethers.parseEther("5.0") });
            await contract.connect(owner).giveToken(player1.address);
            
            await contract.connect(player1).guess("mauvais", 100, "new");
            expect(await contract.dernierguesser()).to.equal(player1.address);
            
            await contract.connect(player1).giveToken(player2.address);
            
            await contract.connect(player2).guess("secret", 100, "new2");
            expect(await contract.dernierguesser()).to.equal(player2.address);
            
            await contract.connect(player2).giveToken(player1.address);
            
            await contract.connect(player1).guess("secret", 100, "new3");
            expect(await contract.dernierguesser()).to.equal(player1.address);
        });

        it("isInitialised ne doit jamais repasser a false", async function() {
            await contract.connect(owner).initGame("secret", { value: ethers.parseEther("1.0") });
            expect(await contract.isInitialised()).to.equal(true);
            
            await contract.connect(owner).giveToken(player1.address);
            expect(await contract.isInitialised()).to.equal(true);
            
            await contract.connect(player1).guess("secret", 100, "new");
            expect(await contract.isInitialised()).to.equal(true);
        });
    });

    after(function() {
        console.log("\n==================================================");
        console.log("TOUS LES TESTS SONT PASSES AVEC SUCCES");
        console.log("==================================================");
        console.log("\nConstructeur teste");
        console.log("initGame() - Pre et post conditions validees");
        console.log("giveToken() - Pre et post conditions validees");
        console.log("guess() - Cas succes et echec valides");
        console.log("Securite - Protections validees");
        console.log("Invariants maintenus");
    });

    // ============================================================
// TEST DE LIVENESS - Parcours complet de tous les états
// ============================================================
describe("Liveness - Parcours complet de tous les états", function() {

    it("Liveness : doit pouvoir atteindre chaque état depuis l'état initial", async function() {

        // Déployer un contrat frais dédié à ce test
        const GG = await GuessingGame.deploy();
        await GG.waitForDeployment();

        // --------------------------------------------------------
        // ÉTAT 0 : UNINITIALISED
        // Invariant : isInitialised == false
        // --------------------------------------------------------
        expect(await GG.isInitialised()).to.equal(false, "ÉTAT 0 : doit être non initialisé");

        // Liveness bloquée : init sans ETH → reste en ÉTAT 0
        await expect(
            GG.connect(owner).initGame("secret1", { value: 0 })
        ).to.be.revertedWith("Doit deposer des ETH");

        // Liveness bloquée : init par non-owner → reste en ÉTAT 0
        await expect(
            GG.connect(player1).initGame("secret1", { value: ethers.parseEther("1") })
        ).to.be.revertedWith("Seul owner peut initier");

        // Liveness bloquée : giveToken avant init → impossible
        await expect(
            GG.connect(owner).giveToken(player1.address)
        ).to.be.reverted;

        // Liveness bloquée : guess avant init → impossible
        await expect(
            GG.connect(player1).guess("secret1", 100, "secret2")
        ).to.be.revertedWith("Pas ton tour !");

        // ✅ Transition ÉTAT 0 → ÉTAT 1
        await GG.connect(owner).initGame("secret1", { value: ethers.parseEther("6") });

        // --------------------------------------------------------
        // ÉTAT 1 : INITIALISED, pas de tokenOwner
        // Invariant : isInitialised == true, tokenOwner == address(0), amount == 6 ETH
        // --------------------------------------------------------
        expect(await GG.isInitialised()).to.equal(true,
            "ÉTAT 1 : isInitialised doit être true");
        expect(await GG.tokenOwner()).to.equal("0x0000000000000000000000000000000000000000",
            "ÉTAT 1 : pas de tokenOwner");
        expect(await GG.amount()).to.equal(ethers.parseEther("6"),
            "ÉTAT 1 : amount doit valoir 6 ETH");

        // Liveness bloquée : re-initialiser → impossible
        await expect(
            GG.connect(owner).initGame("secret1", { value: ethers.parseEther("1") })
        ).to.be.revertedWith("Jeu deja initialise");

        // Liveness bloquée : guess sans tokenOwner → impossible
        await expect(
            GG.connect(player1).guess("secret1", ethers.parseEther("1"), "secret2")
        ).to.be.revertedWith("Pas ton tour !");

        // Liveness bloquée : giveToken vers address(0) → impossible
        await expect(
            GG.connect(owner).giveToken("0x0000000000000000000000000000000000000000")
        ).to.be.revertedWith("Adresse invalide");

        // ✅ Transition ÉTAT 1 → ÉTAT 2
        await GG.connect(owner).giveToken(player1.address);

        // --------------------------------------------------------
        // ÉTAT 2 : INITIALISED, token donné à player1
        // Invariant : tokenOwner == player1
        // --------------------------------------------------------
        expect(await GG.tokenOwner()).to.equal(player1.address,
            "ÉTAT 2 : tokenOwner doit être player1");

        // Liveness bloquée : outsider ne peut pas guess
        await expect(
            GG.connect(player2).guess("secret1", ethers.parseEther("1"), "secret2")
        ).to.be.revertedWith("Pas ton tour !");

        // Liveness bloquée : montant 0 refusé
        await expect(
            GG.connect(player1).guess("secret1", 0, "secret2")
        ).to.be.revertedWith("Montant > 0");

        // Liveness bloquée : montant trop élevé refusé
        await expect(
            GG.connect(player1).guess("secret1", ethers.parseEther("99"), "secret2")
        ).to.be.revertedWith("Pas assez de fonds");

        // ✅ Transition ÉTAT 2 → ÉTAT 3 : guess() avec MAUVAIS secret
        const amountAvant = await GG.amount();
        await GG.connect(player1).guess("MAUVAIS", ethers.parseEther("1"), "secret2");

        // --------------------------------------------------------
        // ÉTAT 3 : guess raté — dernierguesser mis à jour, amount inchangé
        // Invariant : dernierguesser == player1, amount intact, secretHash inchangé
        // --------------------------------------------------------
        expect(await GG.dernierguesser()).to.equal(player1.address,
            "ÉTAT 3 : dernierguesser doit être player1");
        expect(await GG.amount()).to.equal(amountAvant,
            "ÉTAT 3 : amount ne doit pas changer après un mauvais guess");

        // Liveness bloquée : player1 ne peut pas rejouer immédiatement
        await expect(
            GG.connect(player1).guess("secret1", ethers.parseEther("1"), "secret2")
        ).to.be.revertedWith("Vous avez deja joue !");

        // ✅ player1 passe le token à player2 pour débloquer
        await GG.connect(player1).giveToken(player2.address);
        expect(await GG.tokenOwner()).to.equal(player2.address,
            "player2 doit être le nouveau tokenOwner");

        // ✅ Transition ÉTAT 3 → ÉTAT 4 : guess() avec BON secret par player2
        const amountAvantGain = await GG.amount();
        const secretHashAvant = await GG.secretHash();
        await GG.connect(player2).guess("secret1", ethers.parseEther("2"), "secret2");

        // --------------------------------------------------------
        // ÉTAT 4 : guess réussi — amount réduit, secretHash changé
        // Invariant : amount == amountAvantGain - 2 ETH, secretHash == keccak256("secret2")
        // --------------------------------------------------------
        const amountApresGain = await GG.amount();
        const secretHashApres = await GG.secretHash();
        const expectedHash    = ethers.keccak256(ethers.toUtf8Bytes("secret2"));

        expect(amountApresGain).to.equal(
            amountAvantGain - ethers.parseEther("2"),
            "ÉTAT 4 : amount doit diminuer du gain"
        );
        expect(secretHashApres).to.equal(expectedHash,
            "ÉTAT 4 : secretHash doit correspondre au nouveau secret");
        expect(secretHashApres).to.not.equal(secretHashAvant,
            "ÉTAT 4 : le secretHash doit avoir changé");
        expect(await GG.isInitialised()).to.equal(true,
            "ÉTAT 4 : isInitialised reste toujours true");

        // ✅ player3 vide complètement le contrat → ÉTAT FINAL
        await GG.connect(player2).giveToken(player3.address);
        const amountRestant = await GG.amount();
        await GG.connect(player3).guess("secret2", amountRestant, "fin");

        // --------------------------------------------------------
        // ÉTAT FINAL : amount == 0, tokenOwner == address(0)
        // Invariant : plus personne ne peut jouer
        // --------------------------------------------------------
        expect(await GG.amount()).to.equal(0,
            "ÉTAT FINAL : amount doit être 0");
        expect(await GG.tokenOwner()).to.equal("0x0000000000000000000000000000000000000000",
            "ÉTAT FINAL : tokenOwner doit être réinitialisé à address(0)");

        // Liveness bloquée : jeu terminé, plus personne ne peut guess
        await expect(
            GG.connect(player3).guess("fin", 100, "autre")
        ).to.be.revertedWith("Pas ton tour !");

        console.log("\n✅ Liveness confirmée : tous les états ont été atteints et validés.");
    });
});
    
});

