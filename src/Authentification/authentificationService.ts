import insertUser, { InsertUser } from 'Authentification/daos/insertUser';
import retrieveUserByNom, { RetrieveUserByNom } from 'Authentification/daos/retrieveUserByNom';
import { User, UserInfo } from 'Authentification/models';
import { Exception } from 'global/api';
import { Either, Left, Right } from 'monet';
import * as realBcrypt from 'bcrypt';

type BcryptProxy = {
  compare: (data: string | Buffer, encrypted: string) => Promise<boolean>,
  hash: (data: string | Buffer, saltOrRounds: string | number) => Promise<string>
};

const fakeBcrypt: BcryptProxy = {
  compare: (data: string | Buffer, encrypted: string) =>
    Promise.resolve(data === encrypted),
  hash: (data: string | Buffer, saltOrRounds: string | number) =>
    Promise.resolve('###')
};

export class AuthentificationService {
  private readonly insertUser: InsertUser;
  private readonly retrieveUserByNom: RetrieveUserByNom;
  private readonly bcrypt: BcryptProxy;

  constructor(insertUser: InsertUser, retrieveUserByNom: RetrieveUserByNom, bcrypt: BcryptProxy) {
    this.insertUser = insertUser;
    this.retrieveUserByNom = retrieveUserByNom;
    this.bcrypt = bcrypt;
  }

  creerCompte = (user: User): Promise<UserInfo> =>
    this.bcrypt.hash(user.motDePasse, 10)
      .then((mdp) =>
        this.insertUser({
          ...user,
          motDePasse: mdp
        })
      ).then((id) =>
        ({
          id,
          nom: user.nom,
          role: user.role,
          serveurId: user.serveurId,
          tablesIds: user.tablesIds
        })
      );


  verificationConnexion = (nom: string, motDePasse: string): Promise<Either<Exception, UserInfo>> =>
    this.retrieveUserByNom(nom)
      .then((eUser) =>
        eUser.cata(
          (e) => Promise.resolve(Left(e)),
          (mUser) =>
            mUser.cata(
              () => Promise.resolve(Left(Exception('username', 'Utilisateur inconnu'))),
              (user) =>
                this.bcrypt.compare(motDePasse, user.motDePasse)
                  .then((mdpValid) => {
                    if (mdpValid)
                      return Right<Exception, UserInfo>({
                        id: user.id,
                        nom: user.nom,
                        role: user.role,
                        serveurId: user.serveurId,
                        tablesIds: user.tablesIds
                      });
                    else
                      return Left(Exception('motDePasse', 'Mot de passe incorrect'));
                  })
            )
        )
      );
}

const authentificationService = new AuthentificationService(insertUser, retrieveUserByNom, realBcrypt);

export default authentificationService;